import { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { BookingPage } from './pages/BookingPage';
import { BookingsListPage } from './pages/BookingsListPage';
import { ProfilePage } from './pages/ProfilePage';
import { OTPLoginPage } from './pages/OTPLoginPage';

type Page = 'home' | 'book' | 'trips' | 'profile';

interface AuthState {
  token: string | null;
  user: { name?: string; phone: string } | null;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem('gm_token'),
    user: localStorage.getItem('gm_user') ? JSON.parse(localStorage.getItem('gm_user')!) : null,
  }));

  useEffect(() => {
    if (auth.token) {
      localStorage.setItem('gm_token', auth.token);
    } else {
      localStorage.removeItem('gm_token');
      localStorage.removeItem('gm_user');
    }
  }, [auth.token]);

  const handleLogin = (token: string, user: AuthState['user']) => {
    setAuth({ token, user });
    if (user) localStorage.setItem('gm_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth({ token: null, user: null });
    setPage('home');
  };

  if (!auth.token) {
    return <OTPLoginPage onLogin={handleLogin} />;
  }

  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'book', label: 'Book', icon: '🚖' },
    { id: 'trips', label: 'Trips', icon: '📋' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ] as const;

  return (
    <div className="min-h-screen bg-[rgb(15,17,26)] pb-20">
      {/* Page Content */}
      {page === 'home' && <HomePage auth={auth} onBook={() => setPage('book')} />}
      {page === 'book' && <BookingPage auth={auth} onBack={() => setPage('home')} />}
      {page === 'trips' && <BookingsListPage auth={auth} />}
      {page === 'profile' && <ProfilePage auth={auth} onLogout={handleLogout} />}

      {/* Bottom Tab Bar */}
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
