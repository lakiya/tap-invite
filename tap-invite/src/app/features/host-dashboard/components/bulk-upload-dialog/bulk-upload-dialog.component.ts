import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Supabase } from '../../../../core/services/supabase/supabase';
import {
  parseFile,
  validateRows,
  revalidateRows,
  buildTemplate,
  TEMPLATE_FILENAME,
  type AnnotatedGuestRow,
  type ExistingGuestKey,
} from './guest-import';

export interface BulkUploadDialogData {
  eventId: string;
  existingGuests: ExistingGuestKey[];
}

@Component({
  selector: 'app-bulk-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-upload-dialog.component.html',
  styleUrl: './bulk-upload-dialog.component.css',
})
export class BulkUploadDialogComponent {
  private dialogRef = inject(MatDialogRef<BulkUploadDialogComponent>);
  private supabase = inject(Supabase);
  readonly data: BulkUploadDialogData = inject(MAT_DIALOG_DATA);

  step = signal<'upload' | 'preview'>('upload');
  rows = signal<AnnotatedGuestRow[]>([]);
  fileName = signal<string>('');
  fileError = signal<string | null>(null);
  isSaving = signal(false);
  saveError = signal<string | null>(null);

  validCount = computed(() => this.rows().filter(r => r.issues.length === 0).length);
  errorCount = computed(() =>
    this.rows().filter(r =>
      r.issues.some(i => i === 'name_required' || i === 'invalid_phone' || i === 'invalid_email'),
    ).length,
  );
  duplicateCount = computed(() =>
    this.rows().filter(r =>
      r.issues.some(i => i === 'duplicate_in_file' || i === 'duplicate_existing'),
    ).length,
  );
  // How many rows will actually be inserted: clean rows + duplicate-only rows
  // (duplicates are warnings, not hard errors — they do not block save).
  saveCount = computed(() => this.rows().filter(r => this.isSaveable(r)).length);
  canSave = computed(() => this.saveCount() > 0 && this.errorCount() === 0 && !this.isSaving());

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.loadFile(file);
    input.value = ''; // allow re-selecting the same file
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.loadFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  private async loadFile(file: File) {
    this.fileError.set(null);
    this.saveError.set(null);
    this.fileName.set(file.name);
    try {
      const parsed = await parseFile(file);
      this.rows.set(validateRows(parsed, this.data.existingGuests));
      this.step.set('preview');
    } catch (err) {
      this.fileError.set(
        err instanceof Error ? err.message : 'Could not read the file. Please use the template.',
      );
    }
  }

  onCellEdit() {
    // Re-run validation over the current (mutated) rows after any inline edit.
    this.rows.set(revalidateRows(this.rows(), this.data.existingGuests));
  }

  removeRow(rowId: string) {
    const remaining = this.rows().filter(r => r.rowId !== rowId);
    this.rows.set(revalidateRows(remaining, this.data.existingGuests));
  }

  downloadTemplate(format: 'csv' | 'xlsx') {
    const blob = buildTemplate(format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = TEMPLATE_FILENAME[format];
    a.click();
    URL.revokeObjectURL(url);
  }

  // A row is saved if it has no issues, or only duplicate warnings.
  private isSaveable(r: AnnotatedGuestRow): boolean {
    return (
      r.issues.length === 0 ||
      r.issues.every(i => i === 'duplicate_in_file' || i === 'duplicate_existing')
    );
  }

  async save() {
    if (!this.canSave()) return;
    const payload = this.rows()
      .filter(r => this.isSaveable(r))
      .map(r => ({
        display_name: r.display_name,
        phone_number: r.phone_number || null,
        email: r.email || null,
      }));
    if (!payload.length) return;

    this.isSaving.set(true);
    this.saveError.set(null);
    try {
      await this.supabase.addGuestsBulk(this.data.eventId, payload);
      this.dialogRef.close(payload.length);
    } catch {
      this.saveError.set('Failed to save guests. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  backToUpload() {
    this.step.set('upload');
    this.rows.set([]);
    this.fileName.set('');
    this.fileError.set(null);
  }

  cancel() {
    this.dialogRef.close(undefined);
  }
}
