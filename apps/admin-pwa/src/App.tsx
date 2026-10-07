import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AdminLayout } from '@/layouts/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DriversPage } from '@/pages/DriversPage';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { VehicleCategoriesPage } from '@/pages/VehicleCategoriesPage';
import { LocationsPage } from '@/pages/LocationsPage';
import { TaxiStandsPage } from '@/pages/TaxiStandsPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { QueuePage } from '@/pages/QueuePage';
import { SettingsPage } from '@/pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="drivers/*" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="vehicles/categories" element={<VehicleCategoriesPage />} />
        <Route path="locations/*" element={<LocationsPage />} />
        <Route path="taxi-stands/*" element={<TaxiStandsPage />} />
        <Route path="bookings/*" element={<BookingsPage />} />
        <Route path="queue/*" element={<QueuePage />} />
        <Route path="settings/*" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
