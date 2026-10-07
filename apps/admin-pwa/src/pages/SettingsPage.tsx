import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';

const CONFIG_SECTIONS = [
  {
    title: 'Platform',
    icon: '⚙️',
    items: [
      { key: 'PLATFORM_NAME', label: 'Platform Name', value: 'Go Mookambika', type: 'text' },
      { key: 'SUPPORT_PHONE', label: 'Support Phone', value: '+91-9876543210', type: 'tel' },
      { key: 'SUPPORT_EMAIL', label: 'Support Email', value: 'support@gomookambika.com', type: 'email' },
      { key: 'TIMEZONE', label: 'Timezone', value: 'Asia/Kolkata', type: 'text' },
    ],
  },
  {
    title: 'Queue Settings',
    icon: '🚖',
    items: [
      { key: 'DEFAULT_QUEUE_RADIUS', label: 'Default Queue Radius (meters)', value: '100', type: 'number' },
      { key: 'HEARTBEAT_INTERVAL', label: 'Driver Heartbeat Interval (seconds)', value: '30', type: 'number' },
      { key: 'HEARTBEAT_TOLERANCE', label: 'Heartbeat Tolerance (seconds)', value: '60', type: 'number' },
      { key: 'MAX_PROXIMITY_DRIFT', label: 'Max Proximity Drift (meters)', value: '200', type: 'number' },
    ],
  },
  {
    title: 'Fare Settings',
    icon: '💰',
    items: [
      { key: 'CURRENCY', label: 'Currency', value: 'INR', type: 'text' },
      { key: 'CURRENCY_SYMBOL', label: 'Currency Symbol', value: '₹', type: 'text' },
      { key: 'DEFAULT_WAITING_CHARGE', label: 'Default Waiting Charge/min (₹)', value: '1.5', type: 'number' },
      { key: 'NIGHT_START_HOUR', label: 'Night Charge Start Hour (24h)', value: '22', type: 'number' },
      { key: 'NIGHT_END_HOUR', label: 'Night Charge End Hour (24h)', value: '6', type: 'number' },
    ],
  },
  {
    title: 'Notifications',
    icon: '🔔',
    items: [
      { key: 'SMS_PROVIDER', label: 'SMS Provider', value: 'CONSOLE', type: 'text' },
      { key: 'BOOKING_OTP_EXPIRY', label: 'OTP Expiry (minutes)', value: '5', type: 'number' },
    ],
  },
];

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState('Platform');
  const [saved, setSaved] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Platform configuration and preferences</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0 space-y-1">
          {CONFIG_SECTIONS.map(section => (
            <button
              key={section.title}
              onClick={() => setActiveSection(section.title)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all ${
                activeSection === section.title
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.title}
            </button>
          ))}

          <div className="pt-4 border-t border-white/5">
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <span className="mr-2">👤</span>
              My Profile
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <span className="mr-2">📋</span>
              Audit Logs
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {CONFIG_SECTIONS.filter(s => s.title === activeSection).map(section => (
            <div key={section.title} className="card space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>{section.icon}</span> {section.title}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map(item => (
                  <div key={item.key}>
                    <label className="block text-xs text-gray-400 mb-1.5">{item.label}</label>
                    <input
                      type={item.type}
                      defaultValue={item.value}
                      disabled={!isSuperAdmin}
                      className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <div className="text-xs text-gray-600 mt-1 font-mono">{item.key}</div>
                  </div>
                ))}
              </div>

              {isSuperAdmin && (
                <div className="flex justify-end pt-2 border-t border-white/5">
                  <button
                    onClick={handleSave}
                    className={`btn-primary transition-all ${saved ? 'bg-green-500 hover:bg-green-500' : ''}`}
                  >
                    {saved ? '✓ Saved' : 'Save Changes'}
                  </button>
                </div>
              )}

              {!isSuperAdmin && (
                <p className="text-xs text-yellow-400">
                  ⚠️ You need SUPER_ADMIN role to modify settings.
                </p>
              )}
            </div>
          ))}

          {/* Admin Info Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">👤 Logged In As</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 text-xs mb-1">Email</div>
                <div className="text-white">{user?.email ?? '—'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Role</div>
                <div className="text-blue-400 font-medium">{user?.role}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Permissions</div>
                <div className="flex flex-wrap gap-1">
                  {user?.permissions?.slice(0, 5).map(p => (
                    <span key={p} className="text-xs bg-white/5 text-gray-300 px-2 py-0.5 rounded">{p}</span>
                  ))}
                  {(user?.permissions?.length ?? 0) > 5 && (
                    <span className="text-xs text-gray-500">+{(user?.permissions?.length ?? 0) - 5} more</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
