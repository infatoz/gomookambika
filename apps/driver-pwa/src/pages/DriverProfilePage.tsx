import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import {
  User,
  Phone,
  ShieldCheck,
  Car,
  FileText,
  AlertTriangle,
  HelpCircle,
  LogOut,
  ChevronRight,
  Star,
  Info,
  QrCode,
  Wallet,
  Check,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface AuthState {
  token: string | null;
  driver: {
    _id?: string;
    id?: string;
    name: string;
    phone: string;
    driverCode: string;
    status: string;
    upiId?: string;
    upiBeneficiaryName?: string;
    vehicle?: {
      registrationNumber?: string;
      brand?: string;
      vehicleModel?: string;
    };
  } | null;
}

interface DriverProfilePageProps {
  auth: AuthState;
  onLogout: () => void;
  onUpdateDriver?: (updated: Partial<NonNullable<AuthState['driver']>>) => void;
}

export function DriverProfilePage({ auth, onLogout, onUpdateDriver }: DriverProfilePageProps) {
  const d = auth.driver;

  // UPI Settings Modal State
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [upiIdInput, setUpiIdInput] = useState(d?.upiId || '');
  const [upiNameInput, setUpiNameInput] = useState(d?.upiBeneficiaryName || d?.name || '');
  const [previewQr, setPreviewQr] = useState<string>('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiError, setUpiError] = useState('');
  const [upiSuccess, setUpiSuccess] = useState(false);

  // Sync inputs with driver props
  useEffect(() => {
    if (d?.upiId) setUpiIdInput(d.upiId);
    if (d?.upiBeneficiaryName || d?.name) setUpiNameInput(d.upiBeneficiaryName || d.name);
  }, [d?.upiId, d?.upiBeneficiaryName, d?.name]);

  // Generate live preview QR
  useEffect(() => {
    if (!upiIdInput || !upiIdInput.includes('@')) {
      setPreviewQr('');
      return;
    }
    const cleanId = upiIdInput.trim();
    const cleanName = upiNameInput.trim() || d?.name || 'Captain';
    const upiUri = `upi://pay?pa=${cleanId}&pn=${encodeURIComponent(cleanName)}&cu=INR&tn=${encodeURIComponent('Go Mookambika Taxi')}`;
    QRCode.toDataURL(upiUri, {
      width: 240,
      margin: 1,
      color: { dark: '#022c22', light: '#ffffff' },
    })
      .then(url => setPreviewQr(url))
      .catch(() => setPreviewQr(''));
  }, [upiIdInput, upiNameInput, d?.name]);

  const handleSaveUpi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = upiIdInput.trim();
    if (!cleanId || !cleanId.includes('@') || cleanId.length < 5) {
      setUpiError('Please enter a valid UPI ID with @ (e.g. mobile@upi, name@okhdfcbank)');
      return;
    }
    setSavingUpi(true);
    setUpiError('');
    try {
      const res = await api.patch<{ success: boolean; data: { upiId: string; upiBeneficiaryName: string } }>(
        '/drivers/upi',
        { upiId: cleanId, upiBeneficiaryName: upiNameInput.trim() },
        auth.token
      );
      if (res?.data?.upiId) {
        onUpdateDriver?.({
          upiId: res.data.upiId,
          upiBeneficiaryName: res.data.upiBeneficiaryName,
        });
      } else {
        onUpdateDriver?.({
          upiId: cleanId,
          upiBeneficiaryName: upiNameInput.trim(),
        });
      }
      setUpiSuccess(true);
      setTimeout(() => {
        setUpiSuccess(false);
        setUpiModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setUpiError(err?.message || 'Failed to save UPI details. Please check your connection.');
    } finally {
      setSavingUpi(false);
    }
  };

  const menuItems = [
    {
      icon: ShieldCheck,
      label: 'Captain Verification & Documents',
      subtitle: 'Driving Licence, Badge & Aadhar',
      color: 'text-emerald-400',
    },
    {
      icon: Car,
      label: 'Registered Taxi Vehicle',
      subtitle: 'Vehicle Fitness, RC & Commercial Permit',
      color: 'text-blue-400',
    },
    {
      icon: Phone,
      label: 'Association Helpline',
      subtitle: '+91 94812 00000 (24x7 Operations)',
      color: 'text-indigo-400',
      action: () => window.open('tel:+919481200000'),
    },
    {
      icon: AlertTriangle,
      label: 'Emergency SOS Police Support',
      subtitle: 'Instant emergency call to 112',
      color: 'text-rose-400',
      action: () => window.open('tel:112'),
    },
    {
      icon: HelpCircle,
      label: 'Fare Rules & Guidelines',
      subtitle: 'Kollur Stand Queue & Pricing Standards',
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Header Profile Hero Card */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-2xl font-black shadow-lg">
              {d?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{d?.name || 'Captain'}</h2>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">{d?.phone || 'Mobile'}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                {d?.driverCode || 'DRV-001'}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>4.95</span>
              </span>
            </div>
          </div>
        </div>

        {/* Association Badge Bar */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="text-slate-400">Sri Mookambika Taxi Association</div>
          <div className="text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Captain</span>
          </div>
        </div>
      </div>

      {/* ─── UPI SCAN & PAY SETTINGS CARD ───────────────────── */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">UPI Payment Settings</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {d?.upiId ? 'Active' : 'Setup Needed'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Receive trip payments directly to your bank UPI</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-bold text-slate-500">Your UPI ID (VPA)</div>
            <div className="font-mono font-bold text-xs text-white truncate mt-0.5">
              {d?.upiId || <span className="text-amber-400 font-sans font-semibold">Not configured yet</span>}
            </div>
            {d?.upiBeneficiaryName && (
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                Name: <span className="text-slate-300 font-medium">{d.upiBeneficiaryName}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setUpiIdInput(d?.upiId || '');
              setUpiNameInput(d?.upiBeneficiaryName || d?.name || '');
              setUpiError('');
              setUpiModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{d?.upiId ? 'Edit UPI' : 'Configure UPI'}</span>
          </button>
        </div>
      </div>

      {/* Menu Options List */}
      <div className="space-y-2">
        {menuItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 transition-all flex items-center gap-3.5 text-left active:scale-[0.99]"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center shrink-0 ${item.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">{item.label}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* App Version Info */}
      <div className="text-center py-2 text-xs text-slate-500 space-y-0.5">
        <div className="font-semibold text-slate-400">Go Mookambika Captain v1.0.0</div>
        <div>Official Tourist Taxi Captain Platform</div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out from Captain App</span>
      </button>

      {/* ─── UPI PAYMENT SETTINGS MODAL ────────────────────── */}
      {upiModalOpen && (
        <div
          onClick={() => setUpiModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-up"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">UPI Payment Details</h3>
                  <p className="text-xs text-slate-400">Direct scan & pay to your account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUpiModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUpi} className="space-y-4">
              {/* UPI ID Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-300 flex items-center justify-between">
                  <span>Captain UPI ID (VPA) *</span>
                  <span className="text-[10px] text-emerald-400 lowercase font-normal">e.g. 9845123456@ybl</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="yourname@okhdfcbank or phone@upi"
                  value={upiIdInput}
                  onChange={e => {
                    setUpiIdInput(e.target.value.trim());
                    setUpiError('');
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-600 transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500">Quick handles:</span>
                  {['@okaxis', '@okhdfcbank', '@ybl', '@paytm', '@ibl'].map(handle => (
                    <button
                      key={handle}
                      type="button"
                      onClick={() => {
                        const base = upiIdInput.split('@')[0] || (d?.phone?.replace(/\D/g, '').slice(-10) || '9876543210');
                        setUpiIdInput(`${base}${handle}`);
                        setUpiError('');
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-emerald-400 border border-slate-700 transition-all"
                    >
                      {handle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Beneficiary Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-300">
                  Beneficiary / Account Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder={d?.name || 'Full Name on Bank Account'}
                  value={upiNameInput}
                  onChange={e => setUpiNameInput(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-emerald-500 focus:outline-none placeholder:text-slate-600 transition-colors"
                />
              </div>

              {/* Live QR Preview */}
              {previewQr && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/20 text-center space-y-2">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Live UPI QR Preview</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl inline-block shadow-md">
                    <img src={previewQr} alt="UPI QR Preview" className="w-36 h-36 mx-auto object-contain" />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {upiIdInput} • {upiNameInput || d?.name}
                  </div>
                </div>
              )}

              {upiError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {upiError}
                </div>
              )}

              {upiSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>UPI Payment Settings Saved!</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUpiModalOpen(false)}
                  className="py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {savingUpi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save UPI Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
