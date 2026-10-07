interface AuthState {
  token: string | null;
  user: { name?: string; phone: string } | null;
}
interface ProfilePageProps { auth: AuthState; onLogout: () => void; }

export function ProfilePage({ auth, onLogout }: ProfilePageProps) {
  return (
    <div className="safe-area-top px-5 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      {/* User Info */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {auth.user?.name?.charAt(0)?.toUpperCase() ?? auth.user?.phone?.charAt(3) ?? '?'}
          </div>
          <div>
            <div className="text-white font-semibold text-lg">{auth.user?.name ?? 'Customer'}</div>
            <div className="text-gray-400 text-sm">{auth.user?.phone}</div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2">
        {[
          { icon: '📋', label: 'My Trips' },
          { icon: '⭐', label: 'Ratings & Reviews' },
          { icon: '💳', label: 'Payment Methods' },
          { icon: '🔔', label: 'Notifications' },
          { icon: '❓', label: 'Help & Support' },
          { icon: '📜', label: 'Terms & Privacy' },
        ].map(item => (
          <button
            key={item.label}
            className="w-full flex items-center gap-4 card hover:border-white/15 transition-colors text-left active:scale-[0.99]"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-white text-sm flex-1">{item.label}</span>
            <span className="text-gray-600">›</span>
          </button>
        ))}
      </div>

      {/* App Info */}
      <div className="text-center text-xs text-gray-600 py-4">
        <div className="text-gray-500 font-medium mb-1">Go Mookambika</div>
        <div>Version 1.0.0 • Powered by Go Mookambika Taxi Association</div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors active:scale-[0.99]"
      >
        🚪 Sign Out
      </button>
    </div>
  );
}
