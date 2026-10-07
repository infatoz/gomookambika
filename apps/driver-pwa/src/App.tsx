import { useState, useEffect, useCallback } from 'react';
import { OTPLoginPage } from './pages/OTPLoginPage';
import { QueuePage } from './pages/QueuePage';
import { TripPage } from './pages/TripPage';
import { EarningsPage } from './pages/EarningsPage';
import { DriverProfilePage } from './pages/DriverProfilePage';

type Page = 'queue' | 'trips' | 'earnings' | 'profile';

interface AuthState {
  token: string | null;
  driver: { _id: string; name: string; phone: string; status: string; driverCode: string } | null;
}

function App() {
  const [page, setPage] = useState<Page>('queue');
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem('gm_driver_token'),
    driver: localStorage.getItem('gm_driver') ? JSON.parse(localStorage.getItem('gm_driver')!) : null,
  }));

  useEffect(() => {
    if (auth.token) localStorage.setItem('gm_driver_token', auth.token);
    else { localStorage.removeItem('gm_driver_token'); localStorage.removeItem('gm_driver'); }
  }, [auth.token]);

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

  const tabs: { id: Page; label: string; icon: string }[] = [
    { id: 'queue', label: 'Queue', icon: '🚖' },
    { id: 'trips', label: 'Trips', icon: '📋' },
    { id: 'earnings', label: 'Earnings', icon: '💰' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-[rgb(15,17,26)] pb-20">
      {page === 'queue' && <QueuePage auth={auth} />}
      {page === 'trips' && <TripPage auth={auth} />}
      {page === 'earnings' && <EarningsPage auth={auth} />}
      {page === 'profile' && <DriverProfilePage auth={auth} onLogout={handleLogout} />}

      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${page === tab.id ? 'active' : ''}`}
            onClick={() => setPage(tab.id)}
          >
            <span className="text-2xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
