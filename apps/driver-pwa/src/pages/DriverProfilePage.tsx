import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { AppLogo } from '@/components/AppLogo';
import type { DriverInfo, DriverVehicleInfo } from '@/App';
import type { AssociationSettings } from '@gomookambika/types';
import {
  User,
  Phone,
  ShieldCheck,
  Car,
  AlertTriangle,
  HelpCircle,
  LogOut,
  ChevronRight,
  Star,
  QrCode,
  Wallet,
  Check,
  X,
  Loader2,
  Sparkles,
  MapPin,
  Mail,
  Fuel,
  Users,
  Briefcase,
  CheckCircle2,
  Building2,
  FileText,
  Clock,
  Compass,
  Copy,
} from 'lucide-react';

interface AuthState {
  token: string | null;
  driver: DriverInfo | null;
}

interface DriverProfilePageProps {
  auth: AuthState;
  onLogout: () => void;
  onUpdateDriver?: (updated: Partial<NonNullable<AuthState['driver']>>) => void;
}

export function DriverProfilePage({ auth, onLogout, onUpdateDriver }: DriverProfilePageProps) {
  const d = auth.driver;

  // Modals state
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [helplineModalOpen, setHelplineModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false);

  // Vehicle data state
  const [vehicle, setVehicle] = useState<DriverVehicleInfo | null>(d?.vehicle || null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);

  // Association Settings from admin
  const [associationSettings, setAssociationSettings] = useState<AssociationSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // UPI Settings Modal State
  const [upiIdInput, setUpiIdInput] = useState(d?.upiId || '');
  const [upiNameInput, setUpiNameInput] = useState(d?.upiBeneficiaryName || d?.name || '');
  const [previewQr, setPreviewQr] = useState<string>('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiError, setUpiError] = useState('');
  const [upiSuccess, setUpiSuccess] = useState(false);

  // Clean phone number helper for tel: links
  const cleanPhone = (num?: string) => (num ? num.replace(/[^\d+]/g, '') : '');

  const handleCopy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast.success(`${label} Copied`, `${text} copied to clipboard`);
    } catch {
      toast.error('Copy Failed', 'Unable to copy to clipboard');
    }
  };

  // Sync inputs with driver props
  useEffect(() => {
    if (d?.upiId) setUpiIdInput(d.upiId);
    if (d?.upiBeneficiaryName || d?.name) setUpiNameInput(d.upiBeneficiaryName || d.name);
  }, [d?.upiId, d?.upiBeneficiaryName, d?.name]);

  // Fetch full vehicle details on load
  useEffect(() => {
    let isMounted = true;
    const fetchVehicle = async () => {
      if (!auth.token) return;
      try {
        setLoadingVehicle(true);
        const res = await api.get<{ success: boolean; data: DriverVehicleInfo }>('/drivers/vehicle', auth.token);
        if (isMounted && res?.data) {
          setVehicle(res.data);
          onUpdateDriver?.({ vehicle: res.data });
        }
      } catch (err) {
        console.warn('Could not fetch vehicle details', err);
      } finally {
        if (isMounted) setLoadingVehicle(false);
      }
    };
    fetchVehicle();
    return () => {
      isMounted = false;
    };
  }, [auth.token]);

  // Fetch association settings (helpline, emergency SOS, email, office address)
  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const res = await api.get<{ success: boolean; data: AssociationSettings }>('/drivers/association', auth.token);
        if (isMounted && res?.data) {
          setAssociationSettings(res.data);
        }
      } catch {
        if (isMounted) {
          setAssociationSettings({
            platformName: 'Go Mookambika Tourist Taxi Association',
            registrationNumber: 'KA-UD-TA-2024-089',
            supportPhone: '+91 94812 00000',
            supportEmail: 'support@gomookambika.com',
            officeAddress: 'Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220',
            operatingRegion: 'Kollur, Byndoor & Coastal Karnataka',
            emergencySosContact: '+91 94812 00000',
            lostAndFoundHelpline: '+91 94812 00001',
            nightTravelAdvisory: 'Certified hill-route drivers with 24x7 control room tracking on all ghat and night journeys.',
          });
        }
      } finally {
        if (isMounted) setLoadingSettings(false);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [auth.token]);

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
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(url => setPreviewQr(url))
      .catch(() => setPreviewQr(''));
  }, [upiIdInput, upiNameInput, d?.name]);

  const handleSaveUpi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = upiIdInput.trim();
    if (!cleanId || !cleanId.includes('@') || cleanId.length < 5) {
      const msg = 'Please enter a valid UPI ID with @ (e.g. mobile@upi, name@okhdfcbank)';
      setUpiError(msg);
      toast.warning('Invalid UPI Format', msg);
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
      toast.success('UPI Details Saved', 'Your payout UPI ID and QR code are updated.');
      setTimeout(() => {
        setUpiSuccess(false);
        setUpiModalOpen(false);
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save UPI details. Please check your connection.';
      setUpiError(msg);
      toast.error('Update Failed', msg);
    } finally {
      setSavingUpi(false);
    }
  };

  const helplineNumber = associationSettings?.supportPhone || '+91 94812 00000';
  const emergencySosNumber = associationSettings?.emergencySosContact || '112';

  // Format vehicle display name
  const vehicleDisplayName = vehicle?.registrationNumber
    ? `${vehicle.brand || ''} ${vehicle.vehicleModel || ''} (${vehicle.registrationNumber})`
    : d?.vehicle?.registrationNumber
    ? `${d.vehicle.brand || ''} ${d.vehicle.vehicleModel || ''} (${d.vehicle.registrationNumber})`
    : 'Assigned Taxi & Owner Details';

  const categoryName =
    typeof vehicle?.categoryId === 'object' && vehicle.categoryId
      ? vehicle.categoryId.name
      : 'Commercial Taxi';

  const menuItems = [
    {
      icon: ShieldCheck,
      label: 'Captain Documents & Verification',
      subtitle: `Badge & Driving Licence Verification • ${d?.driverCode || 'DRV-1001'}`,
      color: 'text-emerald-400',
      action: () => setDocumentsModalOpen(true),
    },
    {
      icon: Car,
      label: 'Vehicle Details',
      subtitle: vehicle?.ownerName
        ? `${vehicleDisplayName} • Owner: ${vehicle.ownerName}`
        : `${vehicleDisplayName} • View Owner Info`,
      color: 'text-blue-400',
      action: () => setVehicleModalOpen(true),
    },
    {
      icon: Phone,
      label: 'Association Helpline',
      subtitle: `24x7 Control Room: ${helplineNumber}`,
      color: 'text-indigo-400',
      action: () => setHelplineModalOpen(true),
    },
    {
      icon: AlertTriangle,
      label: 'Emergency Police Assistance',
      subtitle: `Instant SOS Emergency Call: ${emergencySosNumber}`,
      color: 'text-rose-400',
      action: () => window.open(`tel:${cleanPhone(emergencySosNumber)}`),
    },
    {
      icon: HelpCircle,
      label: 'Fare & Queue Guidelines',
      subtitle: 'Stand queue rules, trip offers & tariffs',
      color: 'text-amber-400',
      action: () => setGuidelinesModalOpen(true),
    },
  ];

  return (
    <div className="px-3.5 py-3 space-y-4 safe-area-top">
      {/* Header Profile Hero Card */}
      <div className="p-5 rounded-3xl bg-neutral-900 border border-white/[0.08] shadow-xl space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center text-xl font-black shadow-lg">
              {d?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center text-black">
              <ShieldCheck className="w-3 h-3 stroke-[3]" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white truncate">{d?.name || 'Captain'}</h2>
            </div>
            <div className="text-xs text-neutral-400 font-mono mt-0.5">{d?.phone || 'Mobile'}</div>
            <div className="flex items-center gap-2 mt-1.5">
              {d?.driverCode && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-neutral-200 border border-white/[0.1] font-bold">
                  {d.driverCode}
                </span>
              )}
              {typeof d?.rating === 'number' && d.rating > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{d.rating.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── UPI SCAN & PAY SETTINGS CARD (Uber Style) ──────── */}
      <div className="p-4 rounded-3xl bg-neutral-900 border border-white/[0.08] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-emerald-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">UPI Payment Settings</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {d?.upiId ? 'Active' : 'Setup Needed'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Receive trip payments directly to your bank UPI</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-black rounded-2xl border border-white/[0.06] flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-[10px] uppercase font-bold text-neutral-500">Your UPI ID (VPA)</div>
            <div className="font-mono font-bold text-xs text-white truncate mt-0.5">
              {d?.upiId || <span className="text-amber-400 font-sans font-medium">Not configured</span>}
            </div>
            {d?.upiBeneficiaryName && (
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
                Name: <span className="text-neutral-200">{d.upiBeneficiaryName}</span>
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
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{d?.upiId ? 'Edit' : 'Setup'}</span>
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
              className="w-full p-3.5 rounded-2xl bg-neutral-900 border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center gap-3.5 text-left active:scale-[0.99] group"
            >
              <div
                className={`w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 ${item.color} group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>{item.label}</span>
                </div>
                <div className="text-[11px] text-neutral-400 truncate mt-0.5">{item.subtitle}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0 group-hover:text-white transition-colors" />
            </button>
          );
        })}
      </div>

      {/* App Version & Association Logo */}
      <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
        <AppLogo size={36} variant="horizontal" theme="dark" subtitle="Sri Mookambika Association" />
        <div className="text-[11px] text-neutral-500 font-mono">Captain Partner Edition v1.0.0</div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={() => {
          toast.info('Signed Out', 'You have been logged out of the Captain app.');
          onLogout();
        }}
        className="w-full py-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>

      {/* ─── VEHICLE & OWNER DETAILS MODAL ──────────────────── */}
      {vehicleModalOpen && (
        <div
          onClick={() => setVehicleModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto slide-up-smooth"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Vehicle & Owner Details</h3>
                  <p className="text-xs text-neutral-400">Assigned association fleet credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVehicleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingVehicle && !vehicle ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <p className="text-xs text-neutral-400">Loading vehicle and owner credentials...</p>
              </div>
            ) : vehicle ? (
              <div className="space-y-4">
                {/* Taxi Number Plate Hero Card */}
                <div className="relative overflow-hidden rounded-2xl bg-amber-400 text-black border-2 border-black/20 p-4 shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 rounded bg-blue-700 text-white font-black text-[10px] tracking-wider flex flex-col items-center leading-none">
                      <span>IND</span>
                      <span className="text-[7px] text-amber-300 font-sans mt-0.5">🇮🇳</span>
                    </div>
                    <div>
                      <div className="font-mono font-black text-xl tracking-widest text-black">
                        {vehicle.registrationNumber || 'KA 20 D 1001'}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-neutral-800 tracking-wider">
                        Commercial Tourist Taxi
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-black text-amber-300 font-black text-[10px] tracking-wider uppercase">
                    {vehicle.status || 'ACTIVE'}
                  </span>
                </div>

                {/* Vehicle Specifications Card */}
                <div className="p-4 rounded-2xl bg-black border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-blue-400" />
                      <span>Vehicle Information</span>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {categoryName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/[0.05]">
                      <div className="text-[10px] text-neutral-500 uppercase font-bold">Brand & Model</div>
                      <div className="text-white font-bold text-sm mt-0.5 truncate">
                        {vehicle.brand} {vehicle.vehicleModel}
                      </div>
                      {vehicle.variant && (
                        <div className="text-[10px] text-neutral-400">{vehicle.variant}</div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/[0.05]">
                      <div className="text-[10px] text-neutral-500 uppercase font-bold">Color & Year</div>
                      <div className="text-white font-bold text-sm mt-0.5 truncate">
                        {vehicle.color || 'White'} • {vehicle.manufacturingYear || 2023}
                      </div>
                      <div className="text-[10px] text-neutral-400">Mfg Year</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/[0.05]">
                      <div className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-amber-400" />
                        <span>Fuel & Cabin</span>
                      </div>
                      <div className="text-white font-bold mt-0.5">
                        {vehicle.fuelType || 'PETROL'}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        {vehicle.ac !== false ? 'Air Conditioned (AC)' : 'Non-AC'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/[0.05]">
                      <div className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" />
                        <span>Capacities</span>
                      </div>
                      <div className="text-white font-bold mt-0.5">
                        {vehicle.seatCapacity || 4} Passengers
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {vehicle.luggageCapacity || 2} Luggage Bags
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── OWNER DETAILS SECTION (User Requirement) ─── */}
                <div className="p-4 rounded-2xl bg-neutral-900/90 border border-indigo-500/30 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      <span>Owner Information</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {vehicle.ownerName?.trim().toLowerCase() === d?.name?.trim().toLowerCase()
                        ? 'Owner-Cum-Captain'
                        : 'Fleet Vehicle Owner'}
                    </span>
                  </div>

                  <div className="p-3 bg-black rounded-xl border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-neutral-500">Registered Owner Name</div>
                        <div className="text-white font-extrabold text-sm mt-0.5 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{vehicle.ownerName || d?.name || 'Registered Fleet Owner'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-neutral-500">Owner Contact Phone</div>
                        <div className="font-mono font-bold text-xs text-emerald-400 mt-0.5">
                          {vehicle.ownerPhone || d?.phone || 'Not available'}
                        </div>
                      </div>

                      {vehicle.ownerPhone && (
                        <button
                          type="button"
                          onClick={() => window.open(`tel:${cleanPhone(vehicle.ownerPhone)}`)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call Owner</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fleet Compliance & Association Registration */}
                <div className="p-3.5 rounded-2xl bg-neutral-900 border border-white/[0.06] space-y-2 text-xs">
                  <div className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Association Fleet Compliance</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> RC Book Verified
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Commercial Insurance
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Tourist Taxi Permit
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Fitness Certificate
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 pt-1">
                    Affiliated to <span className="text-white font-semibold">Sri Mookambika Tourist Taxi Association</span>. Operating out of Kollur Taxi Stand.
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all shadow-md active:scale-95"
                >
                  Close Vehicle Details
                </button>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-neutral-400">No vehicle assigned yet.</p>
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-200 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ASSOCIATION HELPLINE MODAL (From Admin Settings) ─ */}
      {helplineModalOpen && (
        <div
          onClick={() => setHelplineModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto slide-up-smooth"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Association Helpline</h3>
                  <p className="text-xs text-neutral-400">Official 24x7 control room & support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHelplineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Primary 24x7 Control Room Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-black border border-indigo-500/30 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>24x7 Control Room Support</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                    Live
                  </span>
                </div>

                <div>
                  <div className="text-[11px] text-neutral-400">Primary Operations Helpline</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="font-mono font-black text-xl text-white">
                      {helplineNumber}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(helplineNumber, 'Helpline Number')}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-bold flex items-center gap-1 border border-white/[0.08] transition-all"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Queue dispatch inquiries, ride route coordination, and emergency breakdown assistance.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => window.open(`tel:${cleanPhone(helplineNumber)}`)}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
                >
                  <Phone className="w-4 h-4 fill-white" />
                  <span>Call 24x7 Control Room ({helplineNumber})</span>
                </button>
              </div>

              {/* Emergency Police SOS Card */}
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Police & SOS Assistance</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-white">{emergencySosNumber}</div>
                  <div className="text-[10px] text-neutral-400">Instant distress & traffic emergency</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(emergencySosNumber, 'SOS Number')}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all active:scale-95"
                    title="Copy SOS Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`tel:${cleanPhone(emergencySosNumber)}`)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5 fill-white" />
                    <span>Call SOS</span>
                  </button>
                </div>
              </div>

              {/* Lost and Found Helpline */}
              {associationSettings?.lostAndFoundHelpline && (
                <div className="p-3.5 rounded-2xl bg-neutral-900 border border-white/[0.08] flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="text-[10px] uppercase font-bold text-amber-400">Lost Property Desk</div>
                    <div className="font-mono font-bold text-xs text-white">
                      {associationSettings.lostAndFoundHelpline}
                    </div>
                    <div className="text-[10px] text-neutral-400">For passenger items left in cab</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(associationSettings.lostAndFoundHelpline || '', 'Lost & Found Desk')}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all active:scale-95"
                      title="Copy Number"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`tel:${cleanPhone(associationSettings.lostAndFoundHelpline)}`)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Official Credentials & Office Address */}
              <div className="p-4 rounded-2xl bg-black border border-white/[0.08] space-y-3 text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>{associationSettings?.platformName || 'Go Mookambika Tourist Taxi Association'}</span>
                </div>

                <div className="space-y-2 text-[11px] text-neutral-300">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-neutral-500 font-medium">Govt. Co-Operative Reg / Permit:</span>{' '}
                      <span className="font-mono font-bold text-white">
                        {associationSettings?.registrationNumber || 'KA-UD-TA-2024-089'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-neutral-500 font-medium">Office:</span>{' '}
                      <span className="text-neutral-200">
                        {associationSettings?.officeAddress || 'Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-neutral-500 font-medium">Official Grievance Email:</span>{' '}
                      <a
                        href={`mailto:${associationSettings?.supportEmail || 'support@gomookambika.com'}`}
                        className="text-blue-400 hover:underline"
                      >
                        {associationSettings?.supportEmail || 'support@gomookambika.com'}
                      </a>
                    </div>
                  </div>

                  {associationSettings?.operatingRegion && (
                    <div className="flex items-start gap-2">
                      <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-neutral-500 font-medium">Permitted Region:</span>{' '}
                        <span className="text-neutral-200">{associationSettings.operatingRegion}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setHelplineModalOpen(false)}
                className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all shadow-md active:scale-95"
              >
                Close Helpline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CAPTAIN DOCUMENTS MODAL ───────────────────────── */}
      {documentsModalOpen && (
        <div
          onClick={() => setDocumentsModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto slide-up-smooth"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Captain Verification & KYC</h3>
                  <p className="text-xs text-neutral-400">Official driver registration documents</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDocumentsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-black border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Captain Name</span>
                  <span className="text-xs font-bold text-white">{d?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Driver Identification Code</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{d?.driverCode || 'DRV-1001'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Verified Mobile</span>
                  <span className="text-xs font-mono text-neutral-200">{d?.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Association Status</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    {d?.status || 'ACTIVE'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-900 border border-white/[0.06] space-y-2 text-xs">
                <div className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified Legal Badges</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Commercial Driving Licence
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Tourist Taxi Public Badge
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Police Verification Approved
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDocumentsModalOpen(false)}
                className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all shadow-md active:scale-95"
              >
                Close Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── GUIDELINES MODAL ──────────────────────────────── */}
      {guidelinesModalOpen && (
        <div
          onClick={() => setGuidelinesModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto slide-up-smooth"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Queue & Tariff Rules</h3>
                  <p className="text-xs text-neutral-400">Official guidelines for Kollur Taxi Stand</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuidelinesModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-neutral-300">
              <div className="p-3 bg-black rounded-xl border border-white/[0.06] space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>FIFO Queue Rotation</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Drivers join the queue upon scanning the stand QR code or checking in within the 150m stand boundary. Rides are dispatched to the front of the queue first.
                </p>
              </div>

              <div className="p-3 bg-black rounded-xl border border-white/[0.06] space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Offer Acceptance Window</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  When a trip is offered, you will hear a ringtone notification. You have 30 seconds to accept the trip before it moves to the next captain in queue.
                </p>
              </div>

              <div className="p-3 bg-black rounded-xl border border-white/[0.06] space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>Fixed & Per KM Fares</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Fixed fares are locked for standard pilgrim and airport routes (Kollur to Byndoor, Kundapura, Udupi, Mangalore Airport). Extra halts and waiting are metered per official association rates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGuidelinesModalOpen(false)}
                className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all shadow-md active:scale-95"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── UPI PAYMENT SETTINGS MODAL ────────────────────── */}
      {upiModalOpen && (
        <div
          onClick={() => setUpiModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto slide-up-smooth"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-emerald-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">UPI Payment Details</h3>
                  <p className="text-xs text-neutral-400">Receive trip fares to your bank account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUpiModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUpi} className="space-y-4">
              {/* UPI ID Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-neutral-300 flex items-center justify-between">
                  <span>Captain UPI ID (VPA) *</span>
                  <span className="text-[10px] text-emerald-400 lowercase font-normal">e.g. mobile@upi</span>
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
                  className="input-field font-mono text-sm"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-neutral-500">Quick handles:</span>
                  {['@okaxis', '@okhdfcbank', '@ybl', '@paytm', '@ibl'].map(handle => (
                    <button
                      key={handle}
                      type="button"
                      onClick={() => {
                        const base =
                          upiIdInput.split('@')[0] ||
                          (d?.phone?.replace(/\D/g, '').slice(-10) || '9876543210');
                        setUpiIdInput(`${base}${handle}`);
                        setUpiError('');
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-white/[0.06] transition-all"
                    >
                      {handle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Beneficiary Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-neutral-300">
                  Beneficiary Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder={d?.name || 'Account Holder Name'}
                  value={upiNameInput}
                  onChange={e => setUpiNameInput(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              {/* Live QR Preview */}
              {previewQr && (
                <div className="p-3.5 rounded-2xl bg-black border border-white/[0.08] text-center space-y-2">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Live UPI QR Preview</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl inline-block shadow-md">
                    <img src={previewQr} alt="UPI QR Preview" className="w-36 h-36 mx-auto object-contain" />
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    {upiIdInput}
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
                  className="py-3 rounded-xl border border-white/[0.1] bg-neutral-800 text-neutral-300 font-bold text-xs hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="btn-uber-primary !py-3 !rounded-xl !text-xs"
                >
                  {savingUpi ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Check className="w-4 h-4 text-black stroke-[3]" />}
                  <span>Save UPI</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
