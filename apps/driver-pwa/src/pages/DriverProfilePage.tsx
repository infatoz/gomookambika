interface AuthState { token: string | null; driver: { name: string; phone: string; driverCode: string; status: string } | null; }
interface DriverProfilePageProps { auth: AuthState; onLogout: () => void; }

export function DriverProfilePage({ auth, onLogout }: DriverProfilePageProps) {
  const d = auth.driver;
  return (
    <div className="safe-area-top px-5 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-2xl font-bold text-white">
            {d?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div className="text-white font-semibold text-lg">{d?.name ?? 'Driver'}</div>
            <div className="text-gray-400 text-sm">{d?.phone}</div>
            <div className="text-green-400 text-xs font-mono mt-1">{d?.driverCode}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {[
          { icon: '📊', label: 'Earnings Summary' },
          { icon: '⭐', label: 'My Ratings' },
          { icon: '📄', label: 'Documents' },
          { icon: '❓', label: 'Help & Support' },
          { icon: '📞', label: 'Contact Association' },
        ].map(item => (
          <button key={item.label} className="w-full flex items-center gap-4 card hover:border-white/15 transition-colors text-left active:scale-[0.99]">
            <span className="text-xl">{item.icon}</span>
            <span className="text-white text-sm flex-1">{item.label}</span>
            <span className="text-gray-600">›</span>
          </button>
        ))}
      </div>

      <div className="text-center text-xs text-gray-600 py-2">
        <div className="text-gray-500 font-medium mb-1">Go Mookambika Driver App</div>
        <div>Version 1.0.0</div>
      </div>

      <button onClick={onLogout} className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors">
        🚪 Sign Out
      </button>
    </div>
  );
}
