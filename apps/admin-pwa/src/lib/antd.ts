/**
 * Ant Design static API helpers.
 * Import { antMessage, antModal } from '@/lib/antd' anywhere — no hooks needed.
 */
import { App } from 'antd';

// Re-export the hook for use in components
export const useAntd = App.useApp;

// Singleton refs — set once by AntdAppContext at the root
let _message: ReturnType<typeof App.useApp>['message'] | null = null;
let _modal:   ReturnType<typeof App.useApp>['modal']   | null = null;
let _notification: ReturnType<typeof App.useApp>['notification'] | null = null;

export function setAntdApis(
  msg: ReturnType<typeof App.useApp>['message'],
  modal: ReturnType<typeof App.useApp>['modal'],
  notification: ReturnType<typeof App.useApp>['notification'],
) {
  _message = msg;
  _modal   = modal;
  _notification = notification;
}

export const antMessage = {
  success: (content: string) => _message?.success(content),
  error:   (content: string) => _message?.error(content),
  warning: (content: string) => _message?.warning(content),
  info:    (content: string) => _message?.info(content),
  loading: (content: string) => _message?.loading(content),
};

export const antModal = {
  confirm: (opts: Parameters<ReturnType<typeof App.useApp>['modal']['confirm']>[0]) =>
    _modal?.confirm(opts),
  warning: (opts: Parameters<ReturnType<typeof App.useApp>['modal']['warning']>[0]) =>
    _modal?.warning(opts),
};

export const antNotification = {
  success: (opts: Parameters<ReturnType<typeof App.useApp>['notification']['success']>[0]) =>
    _notification?.success(opts),
  error: (opts: Parameters<ReturnType<typeof App.useApp>['notification']['error']>[0]) =>
    _notification?.error(opts),
};
