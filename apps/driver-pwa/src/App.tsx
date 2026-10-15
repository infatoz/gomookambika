import { useState, useEffect, useCallback } from 'react';
import { OTPLoginPage } from './pages/OTPLoginPage';
import { QueuePage } from './pages/QueuePage';
import { TripPage } from './pages/TripPage';
import { EarningsPage } from './pages/EarningsPage';
import { DriverProfilePage } from './pages/DriverProfilePage';
import { Navigation, ClipboardList, Wallet, User } from 'lucide-react';

type Page = 'queue' | 'trips' | 'earnings' | 'profile';

export interface DriverInfo {
  _id: string;
  name: string;
  phone: string;
  status: string;
  driverCode: string;
  upiId?: string;
  upiBeneficiaryName?: string;
  vehicle?: {
    registrationNumber?: string;
    brand?: string;
    vehicleModel?: string;
  };
}

export interface AuthState {
  token: string | null;
  driver: DriverInfo | null;
}

function App() {
  const [page, setPage] = useState<Page>('queue');
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem('gm_driver_token'),
    driver: localStorage.getItem('gm_driver') ? JSON.parse(localStorage.getItem('gm_driver')!) : null,
  }));

  useEffect(() => {
    if (auth.token) localStorage.setItem('gm_driver_token', auth.token);
    else {
      localStorage.removeItem('gm_driver_token');
      localStorage.removeItem('gm_driver');
    }
  }, [auth.token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuth({ token: null, driver: null });
      setPage('queue');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogin = useCallback((token: string, driver: AuthState['driver']) => {
    setAuth({ token, driver });
    if (driver) localStorage.setItem('gm_driver', JSON.stringify(driver));
  }, []);

  const handleLogout = useCallback(() => {
    setAuth({ token: null, driver: null });
    setPage('queue');
  }, []);

  const handleUpdateDriver = useCallback((updated: Partial<DriverInfo>) => {
    setAuth(prev => {
      if (!prev.driver) return prev;
      const merged = { ...prev.driver, ...updated };
      localStorage.setItem('gm_driver', JSON.stringify(merged));
      return { ...prev, driver: merged };
    });
  }, []);

  if (!auth.token) {
    return <OTPLoginPage onLogin={handleLogin} />;
  }

  const tabs: { id: Page; label: string; icon: typeof Navigation }[] = [
    { id: 'queue', label: 'Drive', icon: Navigation },
    { id: 'trips', label: 'Trips', icon: ClipboardList },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
    { id: 'profile', label: 'Account', icon: User },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-emerald-500 selection:text-black font-sans antialiased">
      {/* Mobile-constrained app shell */}
      <main className="w-full max-w-md mx-auto flex-1 pb-24 relative overflow-x-hidden">
        {page === 'queue' && (
          <QueuePage
            auth={auth}
            onUpdateDriver={handleUpdateDriver}
            onNavigateToEarnings={() => setPage('earnings')}
          />
        )}
        {page === 'trips' && <TripPage auth={auth} />}
        {page === 'earnings' && <EarningsPage auth={auth} />}
        {page === 'profile' && (
          <DriverProfilePage
            auth={auth}
            onLogout={handleLogout}
            onUpdateDriver={handleUpdateDriver}
          />
        )}
      </main>

      {/* Uber Driver Native Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="w-full max-w-md mx-auto bg-black/95 backdrop-blur-2xl border-t border-white/[0.08] px-3 py-1.5 shadow-[0_-12px_32px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-around">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = page === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPage(tab.id)}
                  className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-90 ${
                    isActive
                      ? 'text-white font-bold'
                      : 'text-neutral-400 hover:text-neutral-200 font-medium'
                  }`}
                >
                  <div
                    className={`w-11 h-8 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-white text-black shadow-md scale-105'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[11px] tracking-tight mt-1 transition-colors ${isActive ? 'text-white font-bold' : 'text-neutral-400'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

export default App;
