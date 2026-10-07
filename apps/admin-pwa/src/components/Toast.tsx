import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

let addToastFn: ((msg: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  addToastFn?.(message, type);
}
toast.success = (m: string) => toast(m, 'success');
toast.error   = (m: string) => toast(m, 'error');
toast.warning = (m: string) => toast(m, 'warning');
toast.info    = (m: string) => toast(m, 'info');

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
};

const STYLES: Record<ToastType, { bg: string; border: string; color: string; iconColor: string }> = {
  success: { bg: '#F0FDF4', border: '#86EFAC', color: '#14532D', iconColor: '#16A34A' },
  error:   { bg: '#FEF2F2', border: '#FCA5A5', color: '#7F1D1D', iconColor: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FCD34D', color: '#78350F', iconColor: '#D97706' },
  info:    { bg: '#EFF6FF', border: '#93C5FD', color: '#1E3A5F', iconColor: '#2563EB' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    addToastFn = (message, type = 'success') => {
      const id = ++counter.current;
      setToasts(t => [...t, { id, message, type }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        const s = STYLES[t.type];
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
            padding: '0.875rem 1rem', borderRadius: '12px',
            background: s.bg, border: `1.5px solid ${s.border}`,
            color: s.color, fontSize: '0.8125rem', fontWeight: 500,
            boxShadow: '0 8px 32px rgba(15,23,42,0.14)',
            animation: 'fadeInUp 0.22s cubic-bezier(0.16,1,0.3,1) forwards',
            maxWidth: '320px', lineHeight: 1.45, pointerEvents: 'all',
          }}>
            <Icon size={15} style={{ color: s.iconColor, flexShrink: 0, marginTop: '0.0625rem' }} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: s.color, opacity: 0.5, padding: '0', display: 'flex',
                flexShrink: 0, lineHeight: 1,
              }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
