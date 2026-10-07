import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Car, MapPin, Building2,
  CalendarCheck, Settings, ChevronDown, LogOut, Bell,
  Landmark, ChevronRight, Layers, Menu, X, Activity,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/lib/apiClient';
import { ToastContainer } from '@/components/Toast';

interface NavChild { label: string; to: string; }
interface NavSection { type: 'section'; label: string; }
interface NavItemDef {
  label: string;
  icon: React.ElementType;
  to?: string;
  end?: boolean;
  children?: NavChild[];
  badge?: string;
}
type NavEntry = NavItemDef | NavSection;

const navEntries: NavEntry[] = [
  { label: 'MAIN', type: 'section' },
  { label: 'Dashboard', icon: LayoutDashboard, to: '/', end: true },
  { label: 'Operations', icon: Activity, children: [
    { label: 'Queue Management', to: '/queue' },
    { label: 'Live Bookings',    to: '/bookings' },
  ]},
  { label: 'MANAGEMENT', type: 'section' },
  { label: 'Drivers', icon: Users, to: '/drivers' },
  { label: 'Vehicles', icon: Car, children: [
    { label: 'All Vehicles',    to: '/vehicles' },
    { label: 'Vehicle Types',   to: '/vehicles/categories' },
  ]},
  { label: 'Locations', icon: MapPin, children: [
    { label: 'All Locations', to: '/locations' },
    { label: 'Taxi Stands',   to: '/taxi-stands' },
  ]},
  { label: 'Bookings', icon: CalendarCheck, to: '/bookings' },
  { label: 'SYSTEM', type: 'section' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

const SIDEBAR_W  = 240;
const SIDEBAR_COL = 64;

function NavGroup({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  const location = useLocation();
  const isChildActive = item.children?.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));
  const [open, setOpen] = useState(!!isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        title={collapsed ? item.label : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '0.625rem',
          padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
          borderRadius: '8px',
          background: isChildActive ? 'var(--sidebar-active-bg)' : 'transparent',
          color: isChildActive ? '#fff' : 'var(--sidebar-text)',
          cursor: 'pointer',
          border: 'none',
          transition: 'background 0.12s, color 0.12s',
          fontSize: '0.8125rem',
          fontWeight: isChildActive ? 600 : 500,
        }}
        onMouseEnter={e => { if (!isChildActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-hover)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isChildActive ? 'var(--sidebar-active-bg)' : 'transparent'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <item.icon size={16} style={{ opacity: isChildActive ? 1 : 0.6, flexShrink: 0 }} />
          {!collapsed && <span style={{ letterSpacing: '0.01em' }}>{item.label}</span>}
        </span>
        {!collapsed && (
          <ChevronDown size={13} style={{
            opacity: 0.5, flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s',
          }} />
        )}
      </button>

      {open && !collapsed && (
        <div style={{ marginLeft: '2.25rem', marginTop: '0.125rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {item.children!.map(child => {
            const isActive = location.pathname === child.to || location.pathname.startsWith(child.to + '/');
            return (
              <NavLink
                key={child.to}
                to={child.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 0.625rem', borderRadius: '6px',
                  fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : 'var(--sidebar-text)',
                  background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.12s',
                }}
              >
                <ChevronRight size={11} style={{ opacity: 0.4 }} />
                {child.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavSingleItem({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to!}
      end={item.end}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
        borderRadius: '8px',
        background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
        color: isActive ? '#fff' : 'var(--sidebar-text)',
        fontWeight: isActive ? 600 : 500,
        fontSize: '0.8125rem',
        textDecoration: 'none',
        transition: 'background 0.12s, color 0.12s',
        letterSpacing: '0.01em',
      })}
    >
      {({ isActive }) => (
        <>
          <item.icon size={16} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
          {!collapsed && item.label}
          {!collapsed && item.badge && (
            <span style={{
              marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700,
              background: '#4F46E5', color: '#fff', borderRadius: '999px',
              padding: '0.1rem 0.4rem',
            }}>{item.badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout', {
        refreshToken: useAuthStore.getState().tokens?.refreshToken,
      });
    } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? 'A';

  const SidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Logo bar */}
      <div style={{
        height: '60px', display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 0.75rem' : '0 1rem',
        borderBottom: '1px solid var(--sidebar-border)',
        gap: '0.625rem', flexShrink: 0,
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
            }}>
              <Landmark size={14} style={{ color: '#fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                Go Mookambika
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--sidebar-text)', opacity: 0.7 }}>
                Admin Portal
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
          }}>
            <Landmark size={14} style={{ color: '#fff' }} />
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--sidebar-text)', opacity: 0.6, padding: '0.25rem',
            borderRadius: '6px', display: 'flex', alignItems: 'center',
            transition: 'opacity 0.12s',
          }} title="Collapse sidebar">
            <Menu size={15} />
          </button>
        )}
      </div>

      {/* ── Navigation */}
      <nav style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {navEntries.map((entry, i) => {
          if ('type' in entry) {
            if (collapsed) return null;
            return (
              <div key={i} style={{
                fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--sidebar-text)', opacity: 0.4, padding: '0.875rem 0.75rem 0.25rem',
                textTransform: 'uppercase',
              }}>
                {entry.label}
              </div>
            );
          }
          const item = entry as NavItemDef;
          return item.children
            ? <NavGroup key={item.label} item={item} collapsed={collapsed} />
            : <NavSingleItem key={item.label} item={item} collapsed={collapsed} />;
        })}
      </nav>

      {/* ── User footer */}
      <div style={{
        padding: '0.75rem 0.5rem',
        borderTop: '1px solid var(--sidebar-border)',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setCollapsed(false)} style={{
              width: '34px', height: '34px', borderRadius: '999px',
              background: 'rgba(99,102,241,0.2)', border: 'none', cursor: 'pointer',
              color: '#fff', fontWeight: 700, fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title={`Expand — ${user?.name}`}>
              {initials}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.375rem 0.25rem' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '999px',
              background: 'rgba(99,102,241,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#A5B4FC', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--sidebar-text)', opacity: 0.6, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.role?.replace(/_/g, ' ')}
              </div>
            </div>
            <button onClick={handleLogout} title="Sign out" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-text)', opacity: 0.5, padding: '0.25rem',
              borderRadius: '6px', display: 'flex', alignItems: 'center',
              transition: 'opacity 0.12s, color 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#F87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text)'; }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-app)' }}>

      {/* ── DESKTOP SIDEBAR */}
      <aside style={{
        width: collapsed ? `${SIDEBAR_COL}px` : `${SIDEBAR_W}px`,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 20,
      }} className="hidden md:block">
        {SidebarContent}
        {/* Expand button when collapsed */}
        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{
            position: 'absolute', top: '1rem', right: '-10px',
            width: '20px', height: '20px', borderRadius: '999px',
            background: 'var(--brand-600)', border: '2px solid var(--bg-app)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, boxShadow: '0 2px 8px rgba(79,70,229,0.4)',
          }} title="Expand sidebar">
            <ChevronRight size={10} />
          </button>
        )}
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)',
        }} onClick={() => setMobileOpen(false)}>
          <aside style={{
            width: `${SIDEBAR_W}px`, height: '100%',
            background: 'var(--sidebar-bg)',
            animation: 'slideInLeft 0.22s ease forwards',
          }} onClick={e => e.stopPropagation()}>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.5rem', flexShrink: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          boxShadow: '0 1px 0 var(--border)',
          gap: '1rem',
        }}>
          {/* Left — mobile menu + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button className="md:hidden" onClick={() => setMobileOpen(true)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: '0.25rem',
              display: 'flex', alignItems: 'center',
            }}>
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '999px',
                background: '#10B981', animation: 'pulse-dot 1.5s ease-in-out infinite',
              }} title="Server online" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Right — actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
            <button style={{
              position: 'relative', width: '34px', height: '34px', borderRadius: '8px',
              background: 'transparent', border: '1.5px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
            title="Notifications"
            >
              <Bell size={15} />
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '6px', height: '6px', borderRadius: '999px',
                background: '#EF4444', border: '1.5px solid #fff',
              }} />
            </button>

            <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.125rem' }} />

            {/* User pill */}
            <button onClick={handleLogout} title="Sign out" style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.3125rem 0.75rem 0.3125rem 0.375rem',
              borderRadius: '999px', background: 'transparent',
              border: '1.5px solid var(--border)', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#FECACA'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
            >
              <div style={{
                width: '22px', height: '22px', borderRadius: '999px',
                background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand-600)', fontWeight: 700, fontSize: '0.6rem',
              }}>
                {initials}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Sign out
              </span>
              <LogOut size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1, overflowY: 'auto', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
