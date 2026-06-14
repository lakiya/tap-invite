import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'confirm';
  duration?: number;
  resolve?: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  private _counter = 0;

  readonly toasts = this._toasts.asReadonly();

  success(message: string, duration = 3000): void {
    this._show({ message, type: 'success', duration });
  }

  error(message: string, duration = 3000): void {
    this._show({ message, type: 'error', duration });
  }

  info(message: string, duration = 3000): void {
    this._show({ message, type: 'info', duration });
  }

  warning(message: string, duration = 3000): void {
    this._show({ message, type: 'warning', duration });
  }

  confirm(message: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._show({ message, type: 'confirm', resolve });
    });
  }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private _show(partial: Omit<Toast, 'id'>): void {
    const id = ++this._counter;
    const toast: Toast = { id, ...partial };
    this._toasts.update(list => [...list, toast]);
    if (toast.duration !== undefined) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
  }
}
