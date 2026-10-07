import { Drawer as AntDrawer } from 'antd';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 480 }: DrawerProps) {
  const safeWidth = Math.min(width, typeof window !== 'undefined' ? window.innerWidth : width);
  return (
    <AntDrawer
      open={open}
      onClose={onClose}
      placement="right"
      destroyOnHidden
      styles={{
        wrapper: { width: safeWidth },
        header: {
          borderBottom: '1.5px solid #E8ECF0',
          padding: '1rem 1.5rem',
        },
        body: {
          padding: '1.5rem',
          overflowY: 'auto',
        },
        footer: {
          padding: '0.875rem 1.5rem',
          borderTop: '1.5px solid #E8ECF0',
          background: '#F8FAFC',
        },
      }}
      title={
        <div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.2rem', fontWeight: 400 }}>
              {subtitle}
            </div>
          )}
        </div>
      }
      footer={footer ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
          {footer}
        </div>
      ) : null}
      closeIcon={
        /* antd already renders closeIcon inside a <button> — use a plain span, NOT antd Button */
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', lineHeight: 1, color: '#9CA3AF',
          width: 20, height: 20,
        }}>✕</span>
      }
    >
      {children}
    </AntDrawer>
  );
}
