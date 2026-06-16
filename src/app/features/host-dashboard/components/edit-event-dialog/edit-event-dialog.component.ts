// src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TemplateGalleryComponent } from '../../../../features/templates/components/template-gallery/template-gallery.component';
import { EventData } from '../../../../features/templates/template.types';

export interface EditDialogData {
  event: EventData;
}

export interface EditDialogResult {
  title: string;
  location_text: string;
  template_id: string;
  google_maps_url: string | null;
}

@Component({
  selector: 'app-edit-event-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, TemplateGalleryComponent],
  templateUrl: './edit-event-dialog.component.html',
  styleUrl: './edit-event-dialog.component.css'
})
export class EditEventDialogComponent {
  private dialogRef = inject(MatDialogRef<EditEventDialogComponent>);
  readonly data: EditDialogData = inject(MAT_DIALOG_DATA);

  form = new FormGroup({
    title:           new FormControl(this.data.event.title,                  Validators.required),
    location_text:   new FormControl(this.data.event.location_text ?? ''),
    google_maps_url: new FormControl(this.data.event.google_maps_url ?? ''),
  });

  selectedTemplateId = signal(this.data.event.template_id ?? 'default-minimal');

  save(): void {
    if (this.form.invalid) return;
    const result: EditDialogResult = {
      title:           this.form.value.title!,
      location_text:   this.form.value.location_text ?? '',
      template_id:     this.selectedTemplateId(),
      google_maps_url: this.form.value.google_maps_url || null,
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
