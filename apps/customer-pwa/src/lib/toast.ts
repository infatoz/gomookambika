export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  timestamp: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(type: ToastType, title: string, description?: string, duration = 4000) {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const toast: ToastItem = {
      id,
      type,
      title,
      description,
      duration,
      timestamp: Date.now(),
    };

    // Keep up to 4 concurrent toasts
    this.toasts = [toast, ...this.toasts.slice(0, 3)];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  }

  success(title: string, description?: string, duration?: number) {
    return this.show('success', title, description, duration ?? 4000);
  }

  error(title: string, description?: string, duration?: number) {
    return this.show('error', title, description, duration ?? 5000);
  }

  warning(title: string, description?: string, duration?: number) {
    return this.show('warning', title, description, duration ?? 4500);
  }

  info(title: string, description?: string, duration?: number) {
    return this.show('info', title, description, duration ?? 4000);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  private notify() {
    this.listeners.forEach(fn => fn([...this.toasts]));
  }
}

export const toast = new ToastManager();
