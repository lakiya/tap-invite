import { Component, inject } from '@angular/core';
import { Toast, ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent {
  private toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  icon(type: Toast['type']): string {
    return { success: '✓', error: '✕', info: 'ℹ', warning: '⚠', confirm: '?' }[type];
  }

  confirm(toast: Toast): void {
    toast.resolve?.(true);
    this.toastService.dismiss(toast.id);
  }

  cancel(toast: Toast): void {
    toast.resolve?.(false);
    this.toastService.dismiss(toast.id);
  }
}
