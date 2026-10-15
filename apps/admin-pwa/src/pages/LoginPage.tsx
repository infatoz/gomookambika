import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail, Landmark, ArrowRight, ShieldCheck, Activity, Users, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/lib/apiClient';
import { antMessage } from '@/lib/antd';
import { AppLogo } from '@/components/AppLogo';

const features = [
  { icon: Activity, label: 'Real-time Operations', desc: 'Monitor queue & trips live' },
  { icon: Users,    label: 'Driver Management',    desc: 'Full lifecycle management' },
  { icon: ShieldCheck, label: 'Secure & Reliable',  desc: 'Enterprise-grade security' },
];

export function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { setAuth } = useAuthStore();
  const navigate    = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/auth/admin/login', {
        email: email.trim(),
        password,
      });
      const { user, tokens } = response.data.data;
      setAuth(user, tokens);
      antMessage.success(`Welcome back, ${user.name || 'Admin'}!`);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            error?: { message?: string };
          };
        };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.error?.message ||
        (axiosErr.response?.status === 401
          ? 'Invalid email or password. Please verify your credentials and try again.'
          : axiosErr.message || 'Unable to sign in. Please try again.');
      setError(message);
      antMessage.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: '#F4F6FA' }}>
      {/* ── LEFT PANEL (branding) */}
      <div className="hidden lg:flex" style={{
        width: '440px', flexShrink: 0, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #312E81 0%, #4338CA 45%, #6366F1 100%)',
        display: 'flex', flexDirection: 'column', padding: '2.5rem',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '320px', height: '320px', borderRadius: '999px',
          background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '260px', height: '260px', borderRadius: '999px',
          background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
        }} />

        {/* Brand Logo */}
        <div style={{ position: 'relative' }}>
          <AppLogo size={42} variant="horizontal" theme="dark" subtitle="Taxi Association" />
        </div>

        {/* Middle content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(255,255,255,0.1)', borderRadius: '999px',
            padding: '0.3rem 0.75rem', marginBottom: '1.5rem',
            border: '1px solid rgba(255,255,255,0.15)', width: 'fit-content',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#4ADE80' }} />
            <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
              Platform Active
            </span>
          </div>

          <h1 style={{
            fontSize: '2rem', fontWeight: 800, color: '#fff',
            lineHeight: 1.2, letterSpacing: '-0.03em', marginBottom: '1rem',
          }}>
            Manage your taxi<br />association smarter.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            Drivers, vehicles, locations, queues, and bookings — all in one powerful admin portal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                background: 'rgba(255,255,255,0.07)', borderRadius: '10px',
                padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.12)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color="rgba(255,255,255,0.85)" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6875rem', marginTop: '0.125rem' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6875rem', position: 'relative' }}>
          © 2025 Go Mookambika Association · Admin v1.0
        </div>
      </div>

      {/* ── RIGHT PANEL (form) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '380px', animation: 'fadeInUp 0.3s ease forwards' }}>

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ marginBottom: '2rem' }}>
            <AppLogo size={36} variant="horizontal" theme="light" subtitle="Admin Portal" />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Sign in to your admin account to continue
            </p>
          </div>

          {/* Form card */}
          <div style={{
            background: 'var(--bg-surface)', borderRadius: '16px',
            border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
            padding: '1.75rem',
          }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              {/* Email */}
              <div>
                <label className="form-label">Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none',
                  }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@gomookambika.com"
                    required
                    autoComplete="email"
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none',
                  }} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '10px',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#991B1B',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#DC2626' }} />
                  <div style={{ flex: 1, lineHeight: 1.45 }}>
                    <div style={{ fontWeight: 600, color: '#991B1B', marginBottom: '2px' }}>
                      Sign In Failed
                    </div>
                    <div style={{ color: '#B91C1C' }}>{error}</div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '0.6875rem', fontSize: '0.875rem', marginTop: '0.25rem' }}
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Signing in...</>
                  : <><ArrowRight size={15} /> Sign In</>
                }
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
            Go Mookambika Association Platform · Admin Only
          </p>
        </div>
      </div>
    </div>
  );
}
