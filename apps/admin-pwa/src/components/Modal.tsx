import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  wide?: boolean; // alias for size='lg'
}

const SIZE_MAP = { sm: '400px', md: '520px', lg: '680px' };

export function Modal({ title, subtitle, onClose, children, footer, size = 'md', wide }: ModalProps) {
  const effectiveSize = wide ? 'lg' : size;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: SIZE_MAP[effectiveSize] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-header-title">{title}</div>
            {subtitle && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ maxHeight: '65vh' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

export function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label className="form-label">
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: '0.2rem' }}>*</span>}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{hint}</span>
      )}
    </div>
  );
}

export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: '1rem',
    }}>
      {children}
    </div>
  );
}

export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {title && (
        <div style={{
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)',
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
