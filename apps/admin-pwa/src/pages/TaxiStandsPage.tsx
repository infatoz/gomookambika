import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Select, Typography,
  Tooltip, Modal, Image, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FilterOutlined, QrcodeOutlined,
  DownloadOutlined, ReloadOutlined, HomeOutlined, UndoOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';

const { Title, Text } = Typography;

interface TaxiStand {
  _id: string; name: string; status: string; qrStatus: string; qrGeneratedAt?: string;
  maxQueueSize?: number; queueRadius: number;
  locationId: { _id: string; name: string; code: string };
  allowedVehicleCategories: Array<{ _id: string; name: string; code: string }>;
}
interface LocationOption {
  _id: string;
  name: string;
  code: string;
  type?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
  };
  status?: string;
}
interface CategoryOption  { _id: string; name: string; code: string; }

const EMPTY_FORM = {
  name: '', locationId: '', queueRadius: 150, maxQueueSize: 50,
  allowedVehicleCategories: [] as string[], status: 'ACTIVE',
};
const LIMIT = 15;

export function TaxiStandsPage() {
  const qc = useQueryClient();
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaxiStand | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteTarget, setDeleteTarget]       = useState<TaxiStand | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [reactivatingId, setReactivatingId]   = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen]             = useState(false);
  const [purging, setPurging]                 = useState(false);
  const [qrData, setQrData]         = useState<{ standName: string; url: string } | null>(null);
  const [qrLoading, setQrLoading]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-taxi-stands', page, search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      const r = await apiClient.get(`/admin/taxi-stands?${p}`);
      return r.data;
    },
  });

  const { data: locationsData, isLoading: locationsLoading } = useQuery<LocationOption[]>({
    queryKey: ['active-locations-list'],
    queryFn: async () => {
      const r = await apiClient.get('/admin/locations?status=ACTIVE&limit=1000');
      return r.data?.data ?? [];
    },
  });

  const { data: catData } = useQuery<CategoryOption[]>({
    queryKey: ['vehicle-categories-list'],
    queryFn: async () => { const r = await apiClient.get('/admin/vehicle-categories'); return r.data?.data ?? []; },
  });

  const stands        = data?.data ?? [];
  const meta          = data?.meta ?? { total: 0, totalPages: 1 };
  const rawLocations  = locationsData ?? [];
  // Ensure that if editing a taxi stand whose location is inactive, it's still available in the dropdown
  const locations: LocationOption[] = [...rawLocations];
  if (
    editTarget?.locationId?._id &&
    !locations.some(l => l._id === editTarget.locationId._id)
  ) {
    locations.unshift({
      _id: editTarget.locationId._id,
      name: editTarget.locationId.name,
      code: editTarget.locationId.code,
      status: 'INACTIVE',
    });
  }
  const categories    = catData ?? [];
  const refresh       = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-taxi-stands'] }), [qc]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true); };
  const openEdit = (s: TaxiStand) => {
    setEditTarget(s);
    setForm({
      name: s.name, locationId: s.locationId?._id ?? '',
      queueRadius: s.queueRadius, maxQueueSize: s.maxQueueSize ?? 50,
      allowedVehicleCategories: s.allowedVehicleCategories?.map(c => c._id) ?? [],
      status: s.status,
    });
    setFormError(''); setDrawerOpen(true);
  };

  const toggleCategory = (id: string) => setForm(f => ({
    ...f,
    allowedVehicleCategories: f.allowedVehicleCategories.includes(id)
      ? f.allowedVehicleCategories.filter(c => c !== id)
      : [...f.allowedVehicleCategories, id],
  }));

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Stand name is required'); return; }
    if (!form.locationId)  { setFormError('Please select a location'); return; }
    setSaving(true); setFormError('');
    try {
      if (editTarget) {
        await apiClient.put(`/admin/taxi-stands/${editTarget._id}`, form);
        toast('Taxi stand updated');
      } else {
        await apiClient.post('/admin/taxi-stands', form);
        toast('Taxi stand created');
      }
      setDrawerOpen(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save taxi stand');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const isPerm = permanentDelete || deleteTarget.status === 'INACTIVE';
      await apiClient.delete(`/admin/taxi-stands/${deleteTarget._id}${isPerm ? '?permanent=true' : ''}`);
      toast(isPerm ? 'Taxi stand permanently deleted' : 'Taxi stand deactivated');
      setDeleteTarget(null);
      setPermanentDelete(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? (permanentDelete ? 'Failed to permanently delete taxi stand' : 'Failed to deactivate taxi stand'), 'error');
    } finally { setDeleting(false); }
  };

  const handleReactivate = async (stand: TaxiStand) => {
    setReactivatingId(stand._id);
    try {
      await apiClient.patch(`/admin/taxi-stands/${stand._id}`, { status: 'ACTIVE' });
      toast(`"${stand.name}" reactivated`);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to reactivate taxi stand', 'error');
    } finally { setReactivatingId(null); }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await apiClient.delete('/admin/taxi-stands/purge-inactive');
      toast(res.data?.message ?? 'Inactive taxi stands purged successfully');
      setPurgeOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to purge inactive taxi stands', 'error');
    } finally { setPurging(false); }
  };

  const handleRegenerateQR = async (stand: TaxiStand) => {
    setQrLoading(stand._id);
    try {
      const res = await apiClient.post(`/admin/taxi-stands/${stand._id}/regenerate-qr`, {});
      const url = res.data?.data?.qrDataUrl ?? '';
      setQrData({ standName: stand.name, url });
      refresh(); toast('QR code regenerated');
    } catch { toast('Failed to regenerate QR', 'error'); }
    finally { setQrLoading(null); }
  };

  const columns: ColumnsType<TaxiStand> = [
    {
      title: 'Stand Name',
      render: (_: unknown, s: TaxiStand) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{s.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {s.locationId?.name ?? '—'} · {s.queueRadius}m radius
          </Text>
        </div>
      ),
    },
    {
      title: 'Location',
      render: (_: unknown, s: TaxiStand) => s.locationId
        ? <Tag color="geekblue">{s.locationId.code}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Vehicle Types',
      render: (_: unknown, s: TaxiStand) => (
        <Space size={4} wrap>
          {s.allowedVehicleCategories?.length
            ? s.allowedVehicleCategories.map(c => <Tag key={c._id} style={{ fontSize: 11 }}>{c.name}</Tag>)
            : <Text type="secondary" style={{ fontSize: 12 }}>All types</Text>
          }
        </Space>
      ),
    },
    {
      title: 'Max Queue',
      dataIndex: 'maxQueueSize',
      align: 'center',
      render: (val: number) => <Text strong>{val ?? '—'}</Text>,
    },
    {
      title: 'QR',
      dataIndex: 'qrStatus',
      render: (val: string) => <Tag color={val === 'ACTIVE' ? 'success' : 'default'}>{val ?? 'NONE'}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (val: string) => <Tag color={val === 'ACTIVE' ? 'success' : 'default'}>{val}</Tag>,
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_: unknown, s: TaxiStand) => (
        <Space size={4}>
          <Tooltip title="Edit stand">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(s)} />
          </Tooltip>
          <Tooltip title="Regenerate QR code">
            <Button
              icon={<ReloadOutlined spin={qrLoading === s._id} />}
              size="small"
              onClick={() => handleRegenerateQR(s)}
              loading={qrLoading === s._id}
            />
          </Tooltip>
          {s.status === 'INACTIVE' ? (
            <>
              <Tooltip title="Reactivate taxi stand">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0' }}
                  loading={reactivatingId === s._id}
                  onClick={() => handleReactivate(s)}
                />
              </Tooltip>
              <Tooltip title="Permanently delete from database">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  type="primary"
                  onClick={() => { setDeleteTarget(s); setPermanentDelete(true); }}
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Deactivate stand">
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => { setDeleteTarget(s); setPermanentDelete(false); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div className="page-header">
        <div>
          <Title level={4} style={{ margin: 0, color: '#111827' }}>Taxi Stands</Title>
          <Text type="secondary">{meta.total ?? 0} stands configured</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Stand</Button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: '#fff', padding: '0.75rem 1rem', borderRadius: 12, border: '1.5px solid #E8ECF0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Search stand name..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ maxWidth: 280 }}
        />
        <Select
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          placeholder="All Statuses"
          allowClear
          style={{ minWidth: 150 }}
          suffixIcon={<FilterOutlined />}
          options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
        />
        {statusFilter === 'INACTIVE' && stands.length > 0 && (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setPurgeOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Purge All Inactive ({stands.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <Table
          columns={columns}
          dataSource={stands}
          rowKey="_id"
          loading={isLoading}
          onChange={(p: TablePaginationConfig) => setPage(p.current ?? 1)}
          pagination={{
            current: page, pageSize: LIMIT, total: meta.total ?? 0,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} stands`,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="small"
          locale={{
            emptyText: (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <HomeOutlined style={{ fontSize: 32, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No taxi stands found</div>
                <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 16 }}>
                  {search || statusFilter ? 'Try adjusting filters' : 'Create your first taxi stand'}
                </div>
                {!search && !statusFilter && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">Add Stand</Button>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* QR Modal */}
      <Modal
        open={!!qrData}
        onCancel={() => setQrData(null)}
        footer={null}
        centered
        title={<><QrcodeOutlined /> QR Code — {qrData?.standName}</>}
        width={360}
      >
        {qrData?.url && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
            <Image src={qrData.url} width={200} preview={false} style={{ border: '4px solid #F1F5F9', borderRadius: 12 }} />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                const a = document.createElement('a');
                a.href = qrData.url; a.download = `${qrData.standName}-qr.png`; a.click();
              }}
            >
              Download QR
            </Button>
          </div>
        )}
      </Modal>

      {/* Drawer */}
      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Taxi Stand' : 'Add Taxi Stand'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Configure a new taxi stand'}
        width={500}
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Stand' : 'Create Stand'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13 }}>{formError}</div>
          )}

          <FormSection title="Stand Details">
            <Field label="Stand Name" required hint={!form.name && !editTarget ? 'Can auto-fill after selecting location' : undefined}>
              <input
                className="input-field"
                placeholder="e.g. Main Bus Stand Gate 1"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field
              label="Location"
              required
              hint={
                locationsLoading
                  ? 'Loading active locations...'
                  : `${locations.length} active location${locations.length === 1 ? '' : 's'} available`
              }
            >
              <Select
                showSearch
                value={form.locationId || undefined}
                placeholder="Search active locations by name, code, city..."
                loading={locationsLoading}
                allowClear
                style={{ width: '100%' }}
                size="middle"
                onChange={val => {
                  setForm(f => {
                    const next = { ...f, locationId: val ?? '' };
                    if (!editTarget && !f.name && val) {
                      const sel = locations.find(l => l._id === val);
                      if (sel) next.name = `${sel.name} Stand`;
                    }
                    return next;
                  });
                }}
                filterOption={(input, option) => {
                  const searchStr = String(option?.searchValue ?? '');
                  return searchStr.toLowerCase().includes(input.toLowerCase());
                }}
                options={locations.map(l => ({
                  value: l._id,
                  label: `${l.name} (${l.code})${l.address?.city ? ` · ${l.address.city}` : ''}`,
                  searchValue: `${l.name} ${l.code} ${l.address?.city ?? ''} ${l.address?.line1 ?? ''} ${l.type ?? ''}`,
                  raw: l,
                }))}
                optionRender={option => {
                  const l = (option.data as { raw: LocationOption }).raw;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <EnvironmentOutlined style={{ color: '#4F46E5', fontSize: 13, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.name}
                        </span>
                        <Tag color="geekblue" style={{ fontSize: 10, lineHeight: '18px', padding: '0 4px', margin: 0 }}>
                          {l.code}
                        </Tag>
                        {l.status === 'INACTIVE' && (
                          <Tag color="default" style={{ fontSize: 10, lineHeight: '18px', padding: '0 4px', margin: 0 }}>
                            Inactive
                          </Tag>
                        )}
                      </div>
                      {l.address?.city && (
                        <span style={{ fontSize: 12, color: '#6B7280', flexShrink: 0, marginLeft: 8 }}>
                          {l.address.city}
                        </span>
                      )}
                    </div>
                  );
                }}
                notFoundContent={
                  locationsLoading ? 'Loading locations...' : 'No active locations found'
                }
              />
            </Field>
          </FormSection>

          <FormSection title="Queue Settings">
            <FormGrid cols={2}>
              <Field label="Queue Radius (m)">
                <input type="number" min={10} max={2000} className="input-field" value={form.queueRadius} onChange={e => setForm(f => ({ ...f, queueRadius: +e.target.value }))} />
              </Field>
              <Field label="Max Queue Size">
                <input type="number" min={1} className="input-field" value={form.maxQueueSize} onChange={e => setForm(f => ({ ...f, maxQueueSize: +e.target.value }))} />
              </Field>
            </FormGrid>
            <Field label="Status">
              <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </FormSection>

          <FormSection title="Allowed Vehicle Types">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {categories.length === 0
                ? <Text type="secondary" style={{ fontSize: 13 }}>No categories loaded</Text>
                : categories.map(c => {
                    const selected = form.allowedVehicleCategories.includes(c._id);
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => toggleCategory(c._id)}
                        style={{
                          padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          border: selected ? '1.5px solid #4F46E5' : '1.5px solid #E8ECF0',
                          background: selected ? '#EEF2FF' : '#F8FAFC', color: selected ? '#4338CA' : '#6B7280',
                          transition: 'all 0.12s',
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })
              }
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: '0.5rem' }}>
              Leave empty to allow all vehicle types
            </Text>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? 'Permanently Delete Taxi Stand'
            : 'Deactivate Taxi Stand'
        }
        message={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? `Are you sure you want to permanently delete "${deleteTarget?.name}"? This will completely remove it from the database and cannot be undone.`
            : `Deactivate "${deleteTarget?.name}"? The queue at this stand will be cleared.`
        }
        confirmLabel={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? 'Delete Permanently'
            : 'Deactivate'
        }
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setPermanentDelete(false); }}
      >
        {deleteTarget?.status !== 'INACTIVE' && (
          <div style={{
            padding: '0.625rem 0.75rem', borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA',
          }}>
            <Checkbox
              checked={permanentDelete}
              onChange={e => setPermanentDelete(e.target.checked)}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>
                Permanently delete from database instead (irreversible)
              </span>
            </Checkbox>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={purgeOpen}
        danger
        title="Purge All Inactive Taxi Stands"
        message="Permanently delete all inactive taxi stands from the database? Taxi stands with active queue entries will be safely preserved."
        confirmLabel="Purge Inactive"
        loading={purging}
        onConfirm={handlePurge}
        onCancel={() => setPurgeOpen(false)}
      />
    </div>
  );
}
