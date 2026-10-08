import { useState, useEffect, useCallback } from 'react';
import { OTPLoginPage } from './pages/OTPLoginPage';
import { QueuePage } from './pages/QueuePage';
import { TripPage } from './pages/TripPage';
import { EarningsPage } from './pages/EarningsPage';
import { DriverProfilePage } from './pages/DriverProfilePage';
import { Car, ClipboardList, Wallet, User } from 'lucide-react';

type Page = 'queue' | 'trips' | 'earnings' | 'profile';

export interface DriverInfo {
  _id: string;
  name: string;
  phone: string;
  status: string;
  driverCode: string;
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

  if (!auth.token) {
    return <OTPLoginPage onLogin={handleLogin} />;
  }

  const tabs: { id: Page; label: string; icon: typeof Car }[] = [
    { id: 'queue', label: 'Drive & Queue', icon: Car },
    { id: 'trips', label: 'My Trips', icon: ClipboardList },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans antialiased">
      {/* Mobile-constrained app shell */}
      <main className="w-full max-w-md mx-auto flex-1 pb-24 relative overflow-x-hidden">
        {page === 'queue' && <QueuePage auth={auth} />}
        {page === 'trips' && <TripPage auth={auth} />}
        {page === 'earnings' && <EarningsPage auth={auth} />}
        {page === 'profile' && <DriverProfilePage auth={auth} onLogout={handleLogout} />}
      </main>

      {/* Uber / Namma Yatri style Native Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="w-full max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-around">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = page === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPage(tab.id)}
                  className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'text-emerald-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200 font-medium'
                  }`}
                >
                  <div
                    className={`w-10 h-8 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-400 scale-105'
                        : 'text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="text-[11px] tracking-tight mt-0.5">{tab.label}</span>
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
