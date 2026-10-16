/**
 * Drop-in replacement for the old custom toast.
 * Delegates to Ant Design message API.
 */
import { antMessage, antNotification } from '@/lib/antd';

export function toast(text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
  antMessage[type](text);
}

toast.success = (title: string, description?: string) => {
  if (description) {
    antNotification.success({ message: title, description });
  } else {
    antMessage.success(title);
  }
};

toast.error = (title: string, description?: string) => {
  if (description) {
    antNotification.error({ message: title, description });
  } else {
    antMessage.error(title);
  }
};

toast.info = (title: string, description?: string) => {
  if (description) {
    antNotification.info({ message: title, description });
  } else {
    antMessage.info(title);
  }
};

toast.warning = (title: string, description?: string) => {
  if (description) {
    antNotification.warning({ message: title, description });
  } else {
    antMessage.warning(title);
  }
};

// Legacy export — keep so old code that imports ToastContainer doesn't break
export function ToastContainer() {
  return null;
}
