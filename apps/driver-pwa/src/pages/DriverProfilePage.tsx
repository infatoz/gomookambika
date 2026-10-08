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
} from 'lucide-react';

interface AuthState {
  token: string | null;
  driver: {
    name: string;
    phone: string;
    driverCode: string;
    status: string;
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
}

export function DriverProfilePage({ auth, onLogout }: DriverProfilePageProps) {
  const d = auth.driver;

  const menuItems = [
    {
      icon: ShieldCheck,
      label: 'Driver Verification & Documents',
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
              {d?.name?.charAt(0)?.toUpperCase() || 'D'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{d?.name || 'Driver'}</h2>
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
            <span>Verified Driver</span>
          </div>
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
        <div className="font-semibold text-slate-400">Go Mookambika Driver v1.0.0</div>
        <div>Official Tourist Taxi Driver Platform</div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out from Driver App</span>
      </button>
    </div>
  );
}
