import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Select, Typography,
  Tooltip, Switch, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FilterOutlined, EnvironmentOutlined,
  CompassOutlined, LinkOutlined, UndoOutlined,
} from '@ant-design/icons';
import { X } from 'lucide-react';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';
import { useOsmSearch, parseOsmAddress, type OsmResult } from '@/hooks/useOsmSearch';

const { Title, Text } = Typography;

interface Location {
  _id: string; name: string; code: string; type: string; status: string;
  address: { line1: string; city: string; state: string };
  geoPoint?: { coordinates: [number, number] };
  queueEnabled: boolean; queueRadius: number; bookingEnabled: boolean; qrEnabled: boolean;
}

const LOCATION_TYPES = [
  'TAXI_STAND','HOTEL','HOSPITAL','AIRPORT','RAILWAY_STATION',
  'BUS_STAND','TEMPLE','CITY_LOCATION','CUSTOM',
];

const TYPE_COLOR: Record<string, string> = {
  TAXI_STAND: 'geekblue', HOTEL: 'purple', HOSPITAL: 'red', AIRPORT: 'blue',
  RAILWAY_STATION: 'gold', BUS_STAND: 'orange', TEMPLE: 'yellow',
  CITY_LOCATION: 'green', CUSTOM: 'default',
};

const EMPTY_FORM = {
  name: '', code: '', type: 'CITY_LOCATION', description: '',
  address: { line1: '', city: '', state: 'Karnataka', country: 'India' },
  latitude: '', longitude: '',
  queueEnabled: true, queueRadius: 150, bookingEnabled: true, qrEnabled: false, status: 'ACTIVE',
};
const LIMIT = 15;

/** OSM / Photon address search widget */
function OsmAddressSearch({ onSelect }: { onSelect: (r: OsmResult) => void }) {
  const { results, loading, query, search, clear } = useOsmSearch();
  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (r: OsmResult) => {
    onSelect(r);
    setOpen(false);
    clear();
  };

  // Split display_name into primary (first 2 parts) and secondary (rest)
  const splitName = (name: string) => {
    const parts = name.split(',').map(p => p.trim()).filter(Boolean);
    return {
      primary: parts.slice(0, 2).join(', '),
      secondary: parts.slice(2).join(', '),
    };
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <CompassOutlined style={{
          position: 'absolute', left: '0.75rem', top: '50%',
          transform: 'translateY(-50%)', color: '#4F46E5', zIndex: 1,
        }} />
        {loading && (
          <div style={{ position: 'absolute', right: query ? '2rem' : '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
            <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid #E8ECF0', borderTopColor: '#4F46E5', borderRadius: '50%' }} />
          </div>
        )}
        <input
          value={query}
          onChange={e => { search(e.target.value); setOpen(true); }}
          onFocus={() => { if (results.length > 0 || query.length >= 2) setOpen(true); }}
          placeholder="Type a place name, address, city or landmark..."
          className="input-field"
          style={{ paddingLeft: '2.25rem', paddingRight: query ? '2rem' : '0.75rem' }}
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => { clear(); setOpen(false); }}
            style={{
              position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', display: 'flex', padding: '0.25rem', borderRadius: 4,
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Hint text */}
      {!open && !query && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: '0.35rem', paddingLeft: 2 }}>
          Powered by Photon (OpenStreetMap) — searches worldwide
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 9999, background: '#fff',
          border: '1.5px solid #E8ECF0', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
          maxHeight: 300, overflowY: 'auto',
        }}>
          {/* Loading skeleton */}
          {loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6B7280', fontSize: 13 }}>
              <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid #E8ECF0', borderTopColor: '#4F46E5', borderRadius: '50%', flexShrink: 0 }} />
              Searching places...
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && results.map((r, i) => {
            const { primary, secondary } = splitName(r.display_name);
            return (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                  padding: '0.6875rem 0.875rem', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  borderBottom: i < results.length - 1 ? '1px solid #F8FAFC' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F5F3FF'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
              >
                <EnvironmentOutlined style={{ color: '#4F46E5', marginTop: 3, flexShrink: 0, fontSize: 13 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {primary}
                  </div>
                  {secondary && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {secondary}
                    </div>
                  )}
                </div>
                {/* Coordinates preview */}
                <span style={{ fontSize: 10, color: '#C4B5FD', fontFamily: 'monospace', flexShrink: 0, marginTop: 3 }}>
                  {Number(r.lat).toFixed(4)}, {Number(r.lon).toFixed(4)}
                </span>
              </button>
            );
          })}

          {/* No results */}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '1rem 0.875rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', color: '#9CA3AF' }}>
              <EnvironmentOutlined style={{ fontSize: 20, color: '#E5E7EB' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>No places found for "{query}"</div>
              <div style={{ fontSize: 11 }}>Try a different spelling or add city/state name</div>
            </div>
          )}

          {/* Prompt when query too short */}
          {!loading && query.length > 0 && query.length < 2 && (
            <div style={{ padding: '0.75rem 0.875rem', fontSize: 12, color: '#9CA3AF' }}>
              Type at least 2 characters to search...
            </div>
          )}

          {/* Footer */}
          {results.length > 0 && (
            <div style={{
              padding: '0.4rem 0.875rem', borderTop: '1px solid #F1F5F9',
              fontSize: 10, color: '#C4B5FD', display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}>
              <CompassOutlined style={{ fontSize: 10 }} /> Photon · OpenStreetMap contributors
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ToggleSwitch({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
      <Switch checked={value} onChange={onChange} size="small" />
      <span style={{ fontSize: 14, color: '#4B5563', userSelect: 'none' }}>{label}</span>
    </label>
  );
}

export function LocationsPage() {
  const qc = useQueryClient();
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [codeConflict, setCodeConflict]       = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<Location | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [reactivatingId, setReactivatingId]   = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen]             = useState(false);
  const [purging, setPurging]                 = useState(false);
  const codeInputRef   = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-locations', page, search, typeFilter, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (typeFilter)   p.set('type', typeFilter);
      if (statusFilter) p.set('status', statusFilter);
      const res = await apiClient.get(`/admin/locations?${p}`);
      return res.data;
    },
  });

  const locations: Location[] = data?.data ?? [];
  const meta = data?.meta ?? data?.pagination ?? { total: 0, totalPages: 1 };
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-locations'] }), [qc]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setCodeConflict(false); setDrawerOpen(true); };
  const openEdit = (loc: Location) => {
    setEditTarget(loc);
    setForm({
      name: loc.name, code: loc.code, type: loc.type, description: '',
      address: { line1: loc.address.line1, city: loc.address.city, state: loc.address.state, country: 'India' },
      latitude: String(loc.geoPoint?.coordinates[1] ?? ''),
      longitude: String(loc.geoPoint?.coordinates[0] ?? ''),
      queueEnabled: loc.queueEnabled, queueRadius: loc.queueRadius,
      bookingEnabled: loc.bookingEnabled, qrEnabled: loc.qrEnabled, status: loc.status,
    });
    setFormError(''); setCodeConflict(false); setDrawerOpen(true);
  };

  const sf = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const setAddr = (patch: Partial<typeof EMPTY_FORM.address>) => setForm(f => ({ ...f, address: { ...f.address, ...patch } }));

  const handleOsmSelect = (r: OsmResult) => {
    const parsed = parseOsmAddress(r);
    setForm(f => {
      const generatedCode = !f.code && !editTarget
        ? (parsed.line1 || parsed.city || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 20)
        : f.code;
      return {
        ...f,
        name: f.name || parsed.line1 || parsed.city || '',
        code: generatedCode,
        address: { line1: parsed.line1, city: parsed.city, state: parsed.state, country: parsed.country },
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      };
    });
    if (codeConflict) {
      setCodeConflict(false);
      setFormError('');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Location name is required'); return; }
    if (!form.code.trim()) { setFormError('Location code is required'); return; }
    setSaving(true); setFormError(''); setCodeConflict(false);
    try {
      // Build an explicit, clean payload — avoids accidental spread of form-only fields
      const payload: Record<string, unknown> = {
        name:           form.name.trim(),
        code:           form.code.trim().toUpperCase(),
        type:           form.type,
        description:    form.description,
        address:        form.address,
        status:         form.status,
        queueEnabled:   form.queueEnabled,
        queueRadius:    form.queueRadius,
        bookingEnabled: form.bookingEnabled,
        qrEnabled:      form.qrEnabled,
      };
      if (form.latitude && form.longitude && !isNaN(+form.latitude) && !isNaN(+form.longitude)) {
        payload.geoPoint = { type: 'Point', coordinates: [+form.longitude, +form.latitude] };
      }
      if (editTarget) {
        await apiClient.put(`/admin/locations/${editTarget._id}`, payload);
        toast('Location updated successfully');
      } else {
        await apiClient.post('/admin/locations', payload);
        toast('Location created successfully');
      }
      setDrawerOpen(false); refresh();
    } catch (e: unknown) {
      const res    = (e as { response?: { status?: number; data?: { message?: string } } }).response;
      const status = res?.status;
      const msg    = res?.data?.message;
      if (status === 409) {
        setCodeConflict(true);
        const errMsg = msg || `Code "${form.code.toUpperCase()}" is already in use. Please choose a different code.`;
        setFormError(errMsg);
        toast(errMsg, 'error');
        setTimeout(() => {
          codeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          codeInputRef.current?.focus();
        }, 60);
      } else {
        const errMsg = msg ?? 'Failed to save location';
        setFormError(errMsg);
        toast(errMsg, 'error');
        setTimeout(() => {
          errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const isPerm = permanentDelete || deleteTarget.status === 'INACTIVE';
      await apiClient.delete(`/admin/locations/${deleteTarget._id}${isPerm ? '?permanent=true' : ''}`);
      toast(isPerm ? 'Location permanently deleted' : 'Location deactivated');
      setDeleteTarget(null);
      setPermanentDelete(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? (permanentDelete ? 'Failed to permanently delete' : 'Failed to deactivate location'), 'error');
    } finally { setDeleting(false); }
  };

  const handleReactivate = async (loc: Location) => {
    setReactivatingId(loc._id);
    try {
      await apiClient.patch(`/admin/locations/${loc._id}`, { status: 'ACTIVE' });
      toast(`"${loc.name}" reactivated`);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to reactivate location', 'error');
    } finally { setReactivatingId(null); }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await apiClient.delete('/admin/locations/purge-inactive');
      toast(res.data?.message ?? 'Inactive locations purged successfully');
      setPurgeOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to purge inactive locations', 'error');
    } finally { setPurging(false); }
  };

  const columns: ColumnsType<Location> = [
    {
      title: 'Location',
      render: (_: unknown, loc: Location) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{loc.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{loc.address.line1 || '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      render: (val: string) => <Text code style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{val}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (val: string) => (
        <Tag color={TYPE_COLOR[val] ?? 'default'} style={{ fontSize: 11, fontWeight: 500 }}>
          {val.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'City',
      dataIndex: ['address', 'city'],
      render: (val: string) => <Text>{val || '—'}</Text>,
    },
    {
      title: 'Features',
      render: (_: unknown, loc: Location) => (
        <Space size={4} wrap>
          {loc.queueEnabled    && <Tag color="blue"   style={{ fontSize: 10 }}>Queue {loc.queueRadius}m</Tag>}
          {loc.bookingEnabled  && <Tag color="green"  style={{ fontSize: 10 }}>Booking</Tag>}
          {loc.qrEnabled       && <Tag color="purple" style={{ fontSize: 10 }}>QR</Tag>}
        </Space>
      ),
    },
    {
      title: 'GPS',
      render: (_: unknown, loc: Location) => {
        const lat = loc.geoPoint?.coordinates[1];
        const lng = loc.geoPoint?.coordinates[0];
        return lat && lng ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
            target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4F46E5', fontSize: 12, textDecoration: 'none' }}
          >
            <LinkOutlined />
            <span style={{ fontFamily: 'monospace' }}>{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</span>
          </a>
        ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (val: string) => <Tag color={val === 'ACTIVE' ? 'success' : 'default'}>{val}</Tag>,
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_: unknown, loc: Location) => (
        <Space size={4}>
          <Tooltip title="Edit location">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(loc)} />
          </Tooltip>
          {loc.status === 'INACTIVE' ? (
            <>
              <Tooltip title="Reactivate location">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0' }}
                  loading={reactivatingId === loc._id}
                  onClick={() => handleReactivate(loc)}
                />
              </Tooltip>
              <Tooltip title="Permanently delete from database">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  type="primary"
                  onClick={() => { setDeleteTarget(loc); setPermanentDelete(true); }}
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Deactivate location">
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => { setDeleteTarget(loc); setPermanentDelete(false); }}
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
          <Title level={4} style={{ margin: 0, color: '#111827' }}>Locations</Title>
          <Text type="secondary">{meta.total ?? 0} locations configured</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Location</Button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: '#fff', padding: '0.75rem 1rem', borderRadius: 12, border: '1.5px solid #E8ECF0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)', flexWrap: 'wrap' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Search name, code..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ maxWidth: 260 }}
        />
        <Select
          value={typeFilter || undefined}
          onChange={v => { setTypeFilter(v ?? ''); setPage(1); }}
          placeholder="All Types"
          allowClear
          style={{ minWidth: 180 }}
          suffixIcon={<FilterOutlined />}
          options={LOCATION_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))}
        />
        <Select
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          placeholder="All Statuses"
          allowClear
          style={{ minWidth: 150 }}
          options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
        />
        {statusFilter === 'INACTIVE' && locations.length > 0 && (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setPurgeOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Purge All Inactive ({locations.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <Table
          columns={columns}
          dataSource={locations}
          rowKey="_id"
          loading={isLoading}
          onChange={(p: TablePaginationConfig) => setPage(p.current ?? 1)}
          pagination={{
            current: page, pageSize: LIMIT, total: meta.total ?? 0,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} locations`,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="small"
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <EnvironmentOutlined style={{ fontSize: 32, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No locations found</div>
                <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 16 }}>
                  {search || typeFilter || statusFilter ? 'Try adjusting your filters' : 'Add your first location'}
                </div>
                {!search && !typeFilter && !statusFilter && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">Add Location</Button>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* Drawer */}
      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Location' : 'Add New Location'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Configure a new location'}
        width={520}
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Location' : 'Add Location'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div
              ref={errorBannerRef}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError('')}
                style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          )}

          {/* OSM Search */}
          <FormSection title="Search Address (OpenStreetMap)">
            <OsmAddressSearch onSelect={handleOsmSelect} />
          </FormSection>

          <FormSection title="Basic Information">
            <FormGrid cols={2}>
              <Field label="Location Name" required>
                <input
                  className="input-field"
                  placeholder="e.g. Udupi Bus Stand"
                  value={form.name}
                  onChange={e => {
                    const newName = e.target.value;
                    sf('name', newName);
                    // If adding new location and code is empty, auto-populate clean slug
                    if (!editTarget && !form.code) {
                      const autoCode = newName
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '')
                        .slice(0, 20);
                      sf('code', autoCode);
                    }
                  }}
                />
              </Field>
              <Field label="Code" required hint="Unique uppercase short code">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    ref={codeInputRef}
                    className="input-field"
                    placeholder="UDU_BUS"
                    value={form.code}
                    onChange={e => {
                      sf('code', e.target.value.toUpperCase().replace(/\s+/g, '_'));
                      if (codeConflict) {
                        setCodeConflict(false);
                        setFormError('');
                      }
                    }}
                    style={{
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                      flex: 1,
                      borderColor: codeConflict ? '#EF4444' : undefined,
                      backgroundColor: codeConflict ? '#FEF2F2' : undefined,
                    }}
                  />
                  <Button
                    size="middle"
                    onClick={() => {
                      const base = (form.name || form.address.city || 'LOC')
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '')
                        .slice(0, 14);
                      const rand = Math.floor(100 + Math.random() * 900);
                      sf('code', `${base || 'LOC'}_${rand}`);
                      setCodeConflict(false);
                      setFormError('');
                    }}
                    title="Generate unique code"
                  >
                    Auto
                  </Button>
                </div>
                {codeConflict && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>Code already taken.</span>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4F46E5',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 600,
                        textDecoration: 'underline',
                        fontSize: 12,
                      }}
                      onClick={() => {
                        const nextCode = `${form.code.trim().toUpperCase()}_${Math.floor(10 + Math.random() * 90)}`;
                        sf('code', nextCode);
                        setCodeConflict(false);
                        setFormError('');
                      }}
                    >
                      Use: {form.code.trim().toUpperCase()}_2
                    </button>
                  </div>
                )}
              </Field>
              <Field label="Type" required>
                <select className="input-field" value={form.type} onChange={e => sf('type', e.target.value)}>
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input-field" value={form.status} onChange={e => sf('status', e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Address">
            <Field label="Street / Landmark">
              <input className="input-field" placeholder="Road, landmark, area" value={form.address.line1} onChange={e => setAddr({ line1: e.target.value })} />
            </Field>
            <FormGrid cols={2}>
              <Field label="City">
                <input className="input-field" placeholder="Udupi" value={form.address.city} onChange={e => setAddr({ city: e.target.value })} />
              </Field>
              <Field label="State">
                <input className="input-field" value={form.address.state} onChange={e => setAddr({ state: e.target.value })} />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="GPS Coordinates">
            <FormGrid cols={2}>
              <Field label="Latitude" hint="e.g. 13.8617">
                <input type="number" step="any" className="input-field" placeholder="13.8617" value={form.latitude} onChange={e => sf('latitude', e.target.value)} />
              </Field>
              <Field label="Longitude" hint="e.g. 74.8100">
                <input type="number" step="any" className="input-field" placeholder="74.8100" value={form.longitude} onChange={e => sf('longitude', e.target.value)} />
              </Field>
            </FormGrid>
            {form.latitude && form.longitude && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=16/${form.latitude}/${form.longitude}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4F46E5', textDecoration: 'none', marginTop: 4 }}
              >
                <CompassOutlined /> Preview on OpenStreetMap
              </a>
            )}
          </FormSection>

          <FormSection title="Queue & Booking Settings">
            <Field label="Queue Radius (metres)" hint="Drivers must be within this radius to join queue">
              <input type="number" min={10} max={2000} className="input-field" value={form.queueRadius} onChange={e => sf('queueRadius', +e.target.value)} />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.25rem' }}>
              <ToggleSwitch value={form.queueEnabled}   onChange={() => sf('queueEnabled',   !form.queueEnabled)}   label="Enable Queue Joining" />
              <ToggleSwitch value={form.bookingEnabled} onChange={() => sf('bookingEnabled', !form.bookingEnabled)} label="Enable Bookings from this location" />
              <ToggleSwitch value={form.qrEnabled}      onChange={() => sf('qrEnabled',      !form.qrEnabled)}      label="Enable QR Code Check-in" />
            </div>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? 'Permanently Delete Location'
            : 'Deactivate Location'
        }
        message={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? `Are you sure you want to permanently delete "${deleteTarget?.name}" (${deleteTarget?.code})? This will completely remove it from the database and cannot be undone.`
            : `Deactivate "${deleteTarget?.name}"? It will be marked inactive and hidden from drivers and customers.`
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
        title="Purge All Inactive Locations"
        message="Permanently delete all inactive locations from the database? Any location linked to an existing taxi stand will be safely preserved."
        confirmLabel="Purge Inactive"
        loading={purging}
        onConfirm={handlePurge}
        onCancel={() => setPurgeOpen(false)}
      />
    </div>
  );
}
