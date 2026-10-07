import { Modal, Button } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm',
  danger = true, loading = false, children, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={400}
      centered
      mask={{ closable: !loading }}
      closable={!loading}
      styles={{ body: { padding: '1.5rem' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        {/* Icon */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: danger ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${danger ? '#FECACA' : '#FDE68A'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WarningOutlined style={{ fontSize: '20px', color: danger ? '#DC2626' : '#D97706' }} />
        </div>

        <div style={{ width: '100%' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
            {title}
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6 }}>
            {message}
          </div>
          {children && (
            <div style={{ marginTop: '0.875rem' }}>
              {children}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
          <Button onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="primary"
            danger={danger}
            loading={loading}
            onClick={onConfirm}
            style={{ minWidth: '100px' }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
