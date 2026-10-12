import { User, Phone, ShieldCheck, CreditCard, HelpCircle, FileText, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { AuthState } from '@/lib/api';

interface ProfilePageProps {
  auth: AuthState;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export function ProfilePage({ auth, onLogout, onOpenLogin }: ProfilePageProps) {
  if (!auth.token) {
    return (
      <div className="max-w-md mx-auto min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-6 text-center text-black">
        <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-3xl mb-4">
          👤
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Your Account</h2>
        <p className="text-sm text-neutral-500 mt-2 max-w-xs">
          Log in with your mobile number to view profile settings, saved trips, and driver ratings.
        </p>
        <button
          onClick={onOpenLogin}
          className="mt-6 px-6 py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all shadow-md active:scale-95"
        >
          Log in or Sign up
        </button>
      </div>
    );
  }

  const userName = auth.user?.name || 'Customer';
  const userPhone = auth.user?.phone || '';

  return (
    <div className="max-w-xl mx-auto px-4 py-6 text-black space-y-6">
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-neutral-900">
        Account
      </h1>

      {/* User Info Header Card */}
      <div className="p-5 rounded-3xl bg-neutral-50 border border-neutral-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center font-black text-2xl shadow-sm">
            {userName[0].toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-lg text-neutral-900">{userName}</h2>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">{userPhone}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Passenger
            </span>
          </div>
        </div>
      </div>

      {/* Quick Settings Group */}
      <div className="bg-white rounded-3xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden shadow-xs">
        <div className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-neutral-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Payment & Wallet</h4>
              <p className="text-xs text-neutral-500">Cash, UPI, Google Pay</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </div>

        <div className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-neutral-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Safety & Security</h4>
              <p className="text-xs text-neutral-500">24x7 Association Emergency Helpline</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </div>

        <a
          href="tel:08254258221"
          className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-emerald-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Kollur Temple Taxi Union</h4>
              <p className="text-xs text-neutral-500">Call Dispatch: 08254-258221</p>
            </div>
          </div>
          <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-full">
            Call
          </span>
        </a>

        <div className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-neutral-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Association Bylaws & Tariffs</h4>
              <p className="text-xs text-neutral-500">Government approved temple rates</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="w-full py-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-red-600 font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-neutral-200"
      >
        <LogOut className="w-4 h-4" />
        <span>Log out of Go Mookambika</span>
      </button>

      <div className="text-center text-[11px] text-neutral-400 pt-2">
        Go Mookambika v1.0.0
      </div>
    </div>
  );
}
