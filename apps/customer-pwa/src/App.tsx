import { useState, useEffect } from 'react';
import { UberNavbar } from './components/UberNavbar';
import { UberBookingPage } from './pages/UberBookingPage';
import { BookingsListPage } from './pages/BookingsListPage';
import { ProfilePage } from './pages/ProfilePage';
import { UberLoginModal } from './components/UberLoginModal';
import { ToastContainer } from './components/ToastContainer';
import { toast } from './lib/toast';
import { Car, Clock, User } from 'lucide-react';
import { AuthState } from './lib/api';

type Tab = 'ride' | 'trips' | 'profile';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ride');
  const [globalLoginOpen, setGlobalLoginOpen] = useState(false);
  const [vehiclesModalOpen, setVehiclesModalOpen] = useState(false);

  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const storedToken = localStorage.getItem('gm_token');
      const storedUser = localStorage.getItem('gm_user');
      return {
        token: storedToken,
        user: storedUser ? JSON.parse(storedUser) : null,
      };
    } catch {
      return { token: null, user: null };
    }
  });

  useEffect(() => {
    if (auth.token) {
      localStorage.setItem('gm_token', auth.token);
      if (auth.user) {
        localStorage.setItem('gm_user', JSON.stringify(auth.user));
      }
    } else {
      localStorage.removeItem('gm_token');
      localStorage.removeItem('gm_user');
    }
  }, [auth.token, auth.user]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuth({ token: null, user: null });
      toast.warning('Session Expired', 'Please log in again to continue.');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogin = (token: string, user: { name?: string; phone: string; email?: string; profilePhoto?: string }) => {
    setAuth({ token, user });
    localStorage.setItem('gm_token', token);
    localStorage.setItem('gm_user', JSON.stringify(user));
  };

  const handleUpdateUser = (updatedUser: { name?: string; phone?: string; email?: string; profilePhoto?: string }) => {
    setAuth(prev => {
      if (!prev.user) return prev;
      const merged = { ...prev.user, ...updatedUser };
      localStorage.setItem('gm_user', JSON.stringify(merged));
      return { ...prev, user: merged };
    });
  };

  const handleLogout = () => {
    setAuth({ token: null, user: null });
    localStorage.removeItem('gm_token');
    localStorage.removeItem('gm_user');
    setActiveTab('ride');
    toast.info('Signed Out', 'You have been logged out of your account.');
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans select-none antialiased">
      <ToastContainer />
      {/* ─── UBER TOP NAVBAR ─── */}
      <UberNavbar
        auth={auth}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenLogin={() => setGlobalLoginOpen(true)}
        onLogout={handleLogout}
        onOpenVehiclesModal={() => setVehiclesModalOpen(true)}
      />

      {/* ─── MAIN APPLICATION VIEW ─── */}
      <main className="flex-1 pb-16 md:pb-0 overflow-hidden relative">
        {activeTab === 'ride' && (
          <UberBookingPage
            auth={auth}
            onUpdateAuth={handleLogin}
            onOpenGlobalLogin={() => setGlobalLoginOpen(true)}
            vehiclesModalOpen={vehiclesModalOpen}
            onToggleVehiclesModal={setVehiclesModalOpen}
          />
        )}

        {activeTab === 'trips' && (
          <BookingsListPage
            auth={auth}
            onOpenLogin={() => setGlobalLoginOpen(true)}
            onRebook={() => setActiveTab('ride')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfilePage
            auth={auth}
            onLogout={handleLogout}
            onOpenLogin={() => setGlobalLoginOpen(true)}
            onUpdateUser={handleUpdateUser}
          />
        )}
      </main>

      {/* ─── MOBILE BOTTOM BAR (CLEAN 3-TAB RIDERS NAV) ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 flex items-center justify-around py-2 safe-area-bottom shadow-lg">
        <button
          onClick={() => setActiveTab('ride')}
          className={`flex flex-col items-center justify-center py-1 px-4 transition-colors ${
            activeTab === 'ride' ? 'text-black' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Car className="w-5 h-5" strokeWidth={activeTab === 'ride' ? 2.5 : 2} />
          <span className={`text-[10px] mt-1 ${activeTab === 'ride' ? 'font-bold' : 'font-medium'}`}>
            Ride
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`flex flex-col items-center justify-center py-1 px-4 transition-colors ${
            activeTab === 'trips' ? 'text-black' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Clock className="w-5 h-5" strokeWidth={activeTab === 'trips' ? 2.5 : 2} />
          <span className={`text-[10px] mt-1 ${activeTab === 'trips' ? 'font-bold' : 'font-medium'}`}>
            Activity
          </span>
        </button>

        <button
          onClick={() => (auth.token ? setActiveTab('profile') : setGlobalLoginOpen(true))}
          className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
            activeTab === 'profile' ? 'text-black' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <User className="w-5 h-5" strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className={`text-[10px] mt-1 ${activeTab === 'profile' ? 'font-bold' : 'font-medium'}`}>
            {auth.token ? 'Account' : 'Log in'}
          </span>
        </button>
      </nav>

      {/* Global Login Sheet for logging in whenever the user wants */}
      <UberLoginModal
        isOpen={globalLoginOpen}
        onClose={() => setGlobalLoginOpen(false)}
        onLoginSuccess={handleLogin}
        title="Welcome to Go Mookambika"
        subtitle="Log in or sign up to book cabs and manage trips"
      />
    </div>
  );
}

export default App;
