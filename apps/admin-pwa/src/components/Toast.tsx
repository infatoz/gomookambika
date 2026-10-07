/**
 * Drop-in replacement for the old custom toast.
 * Delegates to Ant Design message API.
 */
import { antMessage } from '@/lib/antd';

export function toast(text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
  antMessage[type](text);
}

toast.success = (text: string) => antMessage.success(text);
toast.error = (text: string) => antMessage.error(text);
toast.info = (text: string) => antMessage.info(text);
toast.warning = (text: string) => antMessage.warning(text);

// Legacy export — keep so old code that imports ToastContainer doesn't break
export function ToastContainer() {
  return null;
}
