import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm',
  danger = true, loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 200 }}
      onClick={onCancel}
    >
      <div
        className="modal-panel animate-scale-in"
        style={{ maxWidth: '380px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1.5rem' }}>
          {/* Icon */}
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: danger ? '#FEF2F2' : '#FFFBEB',
            border: `1px solid ${danger ? '#FECACA' : '#FDE68A'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <AlertTriangle size={20} style={{ color: danger ? '#DC2626' : '#D97706' }} />
          </div>

          {/* Text */}
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.5rem' }}>
            {title}
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onCancel} disabled={loading} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'btn-danger' : 'btn-primary'}
            style={{ minWidth: '100px' }}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Please wait...</>
              : confirmLabel
            }
          </button>
        </div>
      </div>
    </div>
  );
}
