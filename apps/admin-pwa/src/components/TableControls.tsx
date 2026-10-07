import { Search, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   SEARCH INPUT
   ───────────────────────────────────────────────────────────── */
interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}
export function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
      <Search size={14} style={{
        position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text-muted)', pointerEvents: 'none',
      }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        style={{ paddingLeft: '2.25rem', paddingRight: value ? '2rem' : undefined }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{
          position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: '0.25rem',
        }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FILTER SELECT
   ───────────────────────────────────────────────────────────── */
interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}
export function FilterSelect({ value, onChange, options, placeholder = 'All' }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input-field"
      style={{ minWidth: '140px' }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ─────────────────────────────────────────────────────────────
   SORT HEADER
   ───────────────────────────────────────────────────────────── */
interface SortHeaderProps {
  label: string;
  field: string;
  sort: { field: string; dir: 'asc' | 'desc' };
  onSort: (field: string) => void;
  align?: 'left' | 'right';
}
export function SortHeader({ label, field, sort, onSort, align = 'left' }: SortHeaderProps) {
  const active = sort.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        cursor: 'pointer', userSelect: 'none',
        textAlign: align,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {label}
        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', opacity: active ? 1 : 0.3 }}>
          <ChevronUp size={9} style={{ color: active && sort.dir === 'asc' ? 'var(--brand-600)' : 'inherit', marginBottom: '-2px' }} />
          <ChevronDown size={9} style={{ color: active && sort.dir === 'desc' ? 'var(--brand-600)' : 'inherit' }} />
        </span>
      </span>
    </th>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGINATION
   ───────────────────────────────────────────────────────────── */
interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}
export function Pagination({ page, totalPages, total, limit, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Show at most 5 page buttons
  const pages: number[] = [];
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, start + 4);
  start     = Math.max(1, end - 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 1rem', borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface-2)',
    }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {from}–{to} of {total} results
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <button
          onClick={() => onPage(page - 1)} disabled={page <= 1}
          className="btn-icon" style={{ width: '28px', height: '28px' }}
        >
          <ChevronLeft size={13} />
        </button>
        {start > 1 && (
          <>
            <PageBtn p={1} current={page} onPage={onPage} />
            {start > 2 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.125rem' }}>…</span>}
          </>
        )}
        {pages.map(p => <PageBtn key={p} p={p} current={page} onPage={onPage} />)}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.125rem' }}>…</span>}
            <PageBtn p={totalPages} current={page} onPage={onPage} />
          </>
        )}
        <button
          onClick={() => onPage(page + 1)} disabled={page >= totalPages}
          className="btn-icon" style={{ width: '28px', height: '28px' }}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

function PageBtn({ p, current, onPage }: { p: number; current: number; onPage: (p: number) => void }) {
  const active = p === current;
  return (
    <button
      onClick={() => onPage(p)}
      style={{
        width: '28px', height: '28px', borderRadius: '6px',
        border: active ? 'none' : '1.5px solid var(--border)',
        background: active ? 'var(--brand-600)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontWeight: active ? 700 : 400,
        fontSize: '0.75rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.1s',
      }}
    >
      {p}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   TABLE SKELETON
   ───────────────────────────────────────────────────────────── */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: '0.875rem 1rem' }}>
              <div className="skeleton" style={{ height: '13px', width: c === 0 ? '60%' : '80%', borderRadius: '4px' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
