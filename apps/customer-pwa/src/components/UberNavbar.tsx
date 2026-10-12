import { useState } from 'react';
import { User, Menu, X, Car, Clock, Shield, LogOut, ChevronRight, Phone } from 'lucide-react';

import { AuthState } from '@/lib/api';

interface UberNavbarProps {
  auth: AuthState;
  activeTab: 'ride' | 'trips' | 'profile';
  onSelectTab: (tab: 'ride' | 'trips' | 'profile') => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function UberNavbar({
  auth,
  activeTab,
  onSelectTab,
  onOpenLogin,
  onLogout,
}: UberNavbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 px-4 md:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onSelectTab('ride')}
              className="flex items-center gap-2 text-left group"
            >
              <span className="text-2xl font-black tracking-tighter text-black select-none">
                Uber
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200">
                Go Mookambika
              </span>
            </button>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => onSelectTab('ride')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'ride'
                    ? 'bg-black text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Ride
              </button>
              <button
                onClick={() => onSelectTab('trips')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'trips'
                    ? 'bg-black text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Activity
              </button>
            </nav>
          </div>

          {/* Right: Actions & User Info */}
          <div className="flex items-center gap-2.5">
            {auth.token ? (
              <button
                onClick={() => onSelectTab('profile')}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors border border-neutral-200"
              >
                <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                  {auth.user?.name ? auth.user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="text-xs font-semibold text-neutral-800 max-w-[100px] truncate hidden sm:inline">
                  {auth.user?.name || auth.user?.phone || 'Account'}
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white hover:bg-neutral-800 transition-all text-xs font-bold active:scale-95 shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log in</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors md:hidden text-black"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Side Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="relative ml-auto w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 p-6 uber-slide-up text-black">
            <div className="flex items-center justify-between pb-6 border-b border-neutral-100">
              <span className="font-black text-2xl tracking-tighter">Uber</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-neutral-700" />
              </button>
            </div>

            {/* Profile Bar in Drawer */}
            <div className="py-5 border-b border-neutral-100">
              {auth.token ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
                    {auth.user?.name ? auth.user.name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-neutral-900 leading-tight">
                      {auth.user?.name || 'Rider'}
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">{auth.user?.phone}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600">Sign in to sync your trips & faster bookings</p>
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full py-2.5 bg-black text-white font-bold rounded-xl text-sm hover:bg-neutral-800 transition-all"
                  >
                    Log in / Sign up
                  </button>
                </div>
              )}
            </div>

            {/* Navigation links */}
            <div className="py-4 space-y-1 flex-1">
              <button
                onClick={() => {
                  onSelectTab('ride');
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'ride' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-50 text-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5" />
                  <span>Book a Ride</span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>

              <button
                onClick={() => {
                  onSelectTab('trips');
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'trips' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-50 text-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" />
                  <span>My Activity & Trips</span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>

              <button
                onClick={() => {
                  onSelectTab('profile');
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'profile' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-50 text-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5" />
                  <span>Account & Profile</span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>

              <div className="pt-4 border-t border-neutral-100 space-y-1">
                <a
                  href="tel:08254258221"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-neutral-600 hover:bg-neutral-50 rounded-xl"
                >
                  <Phone className="w-4 h-4" />
                  <span>Association Helpline: 08254-258221</span>
                </a>
                <div className="flex items-center gap-3 px-3 py-2 text-xs text-neutral-500">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Official Kollur Temple Taxi Union</span>
                </div>
              </div>
            </div>

            {/* Logout button if authenticated */}
            {auth.token && (
              <div className="pt-4 border-t border-neutral-200">
                <button
                  onClick={() => {
                    onLogout();
                    setDrawerOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
