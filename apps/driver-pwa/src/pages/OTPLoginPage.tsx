import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Car, ShieldCheck, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';

interface OTPLoginPageProps {
  initialError?: string | null;
  onLogin: (
    token: string,
    driver: { _id: string; name: string; phone: string; status: string; driverCode: string; vehicle?: any }
  ) => void;
}

export function OTPLoginPage({ onLogin, initialError }: OTPLoginPageProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const cleanPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const handleRequestOTP = async () => {
    const raw = cleanPhone(phone);
    if (raw.length !== 10 || !/^[6-9]\d{9}$/.test(raw)) {
      const msg = 'Please enter a valid 10-digit mobile number';
      setError(msg);
      toast.warning('Invalid Mobile Number', msg);
      return;
    }
    const phoneNum = `+91${raw}`;
    setError('');
    setLoading(true);
    try {
      // Pass role: 'DRIVER' so backend validates driver registration and assigned vehicle
      await api.post('/auth/otp/request', { phone: phoneNum, purpose: 'LOGIN', role: 'DRIVER' });
      toast.success('OTP Sent', `Verification code sent to +91 ${raw}`);
      setStep('otp');
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send OTP. Please check your network.';
      setError(msg);
      toast.error('Could Not Send OTP', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      const msg = 'Enter 6-digit OTP';
      setError(msg);
      toast.warning('Incomplete Code', 'Please enter all 6 digits of the OTP');
      return;
    }
    const raw = cleanPhone(phone);
    const phoneNum = `+91${raw}`;
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{
        data: { tokens: { accessToken: string }; user: { _id: string; name: string; phone: string; role: string } };
      }>('/auth/otp/verify', { phone: phoneNum, otp, purpose: 'LOGIN', role: 'DRIVER' });

      const token = res.data.tokens.accessToken;
      const user = res.data.user;

      // Verify that an active vehicle is assigned to this driver
      try {
        const dRes = await api.get<{
          data: { _id: string; name: string; phone: string; status: string; driverCode: string; vehicle?: any };
        }>('/drivers/me', token);

        if (!dRes?.data?.vehicle) {
          const msg = 'No vehicle is currently assigned to your captain account. Only drivers with an assigned vehicle can log in. Please contact the association administrator.';
          setError(msg);
          toast.error('Vehicle Not Assigned', msg);
          setLoading(false);
          return;
        }

        const driverProfile = {
          _id: dRes.data._id || user._id,
          name: dRes.data.name || user.name,
          phone: dRes.data.phone || user.phone,
          status: dRes.data.status || 'AVAILABLE',
          driverCode: dRes.data.driverCode || '',
          vehicle: dRes.data.vehicle,
        };

        toast.success(`Welcome back, ${driverProfile.name || 'Captain'}!`, 'Logged into driver terminal.');
        onLogin(token, driverProfile);
      } catch (err: any) {
        const msg = err?.message || 'Access Denied: No vehicle is assigned to your captain account. Please contact the association administrator.';
        setError(msg);
        toast.error('Access Denied', msg);
        setLoading(false);
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid OTP. Please check and try again.';
      setError(msg);
      toast.error('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col justify-between px-6 py-10 bg-black text-white max-w-md mx-auto">
      {/* Brand Header */}
      <div className="space-y-4 pt-8">
        <AppLogo size={58} variant="mark" theme="dark" />
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-2">
            Go Mookambika Captain
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Captain Partner</h1>
          <p className="text-xs text-neutral-400 mt-1">Sri Mookambika Tourist Taxi Association</p>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="w-full space-y-4 my-auto">
        {step === 'phone' ? (
          <>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-bold block">
                Enter Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="px-4 py-3.5 rounded-2xl bg-neutral-900 border border-white/[0.1] text-white font-mono font-black text-sm flex items-center shrink-0">
                  +91
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => {
                    setPhone(cleanPhone(e.target.value));
                    setError('');
                  }}
                  className="input-field !text-lg font-mono tracking-wider flex-1"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-700/80 rounded-2xl text-rose-200 text-xs space-y-2 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{error}</span>
                </div>
                {(error.toLowerCase().includes('vehicle') ||
                  error.toLowerCase().includes('captain') ||
                  error.toLowerCase().includes('registered') ||
                  error.toLowerCase().includes('denied')) && (
                  <div className="pt-2 border-t border-rose-900/60 flex items-center justify-between text-[11px] text-rose-300">
                    <span>Association Admin Desk:</span>
                    <a href="tel:+918254258221" className="text-white font-bold underline hover:text-emerald-400">
                      08254-258221
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleRequestOTP}
              disabled={loading || phone.length < 10}
              className="btn-uber-primary"
            >
              <span>{loading ? 'Sending Code...' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-xs text-neutral-400">
                Code sent to <span className="font-bold text-white font-mono">+91 {phone}</span>
              </div>
              <button
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="text-emerald-400 text-xs hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Edit number</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-neutral-400 font-bold">
                6-Digit Verification PIN
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                placeholder="• • • • • •"
                onChange={e => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                className="w-full text-center text-3xl tracking-[0.25em] font-mono font-bold py-3.5 bg-neutral-900 border border-white/[0.1] rounded-2xl text-white outline-none focus:border-emerald-500"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              />
            </div>

            {error && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-700/80 rounded-2xl text-rose-200 text-xs space-y-2 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{error}</span>
                </div>
                {(error.toLowerCase().includes('vehicle') ||
                  error.toLowerCase().includes('captain') ||
                  error.toLowerCase().includes('registered') ||
                  error.toLowerCase().includes('denied')) && (
                  <div className="pt-2 border-t border-rose-900/60 flex items-center justify-between text-[11px] text-rose-300">
                    <span>Association Admin Desk:</span>
                    <a href="tel:+918254258221" className="text-white font-bold underline hover:text-emerald-400">
                      08254-258221
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length < 6}
              className="btn-uber-primary"
            >
              <span>{loading ? 'Verifying...' : 'Sign In'}</span>
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
            </button>

            <div className="text-center pt-2">
              <button
                onClick={handleRequestOTP}
                disabled={loading || resendCooldown > 0}
                className="text-xs text-neutral-400 hover:text-white disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-neutral-500 pb-2">
        Official Driver App • Sri Mookambika Association
      </div>
    </div>
  );
}
