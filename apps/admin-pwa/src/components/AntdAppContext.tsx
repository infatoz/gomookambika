import { useEffect } from 'react';
import { App } from 'antd';
import { setAntdApis } from '@/lib/antd';

/**
 * Must be rendered inside <AntApp> (already done in main.tsx).
 * Registers message / modal / notification static APIs.
 */
export function AntdAppContext({ children }: { children: React.ReactNode }) {
  const { message, modal, notification } = App.useApp();

  useEffect(() => {
    setAntdApis(message, modal, notification);
  }, [message, modal, notification]);

  return <>{children}</>;
}
