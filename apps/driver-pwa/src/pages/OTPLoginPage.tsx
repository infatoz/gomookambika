import { useState } from 'react';
import { api } from '@/lib/api';
import { Car, ShieldCheck, ArrowRight, Sparkles, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';

interface OTPLoginPageProps {
  onLogin: (
    token: string,
    driver: { _id: string; name: string; phone: string; status: string; driverCode: string }
  ) => void;
}

export function OTPLoginPage({ onLogin }: OTPLoginPageProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const cleanPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const handleRequestOTP = async () => {
    const raw = cleanPhone(phone);
    if (raw.length !== 10 || !/^[6-9]\d{9}$/.test(raw)) {
      setError('Please enter a valid 10-digit mobile number starting with 6-9');
      return;
    }
    const phoneNum = `+91${raw}`;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { phone: phoneNum, purpose: 'LOGIN' });
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
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Enter 6-digit OTP');
      return;
    }
    const raw = cleanPhone(phone);
    const phoneNum = `+91${raw}`;
    setError('');
    setLoading(true);
    try {
      // Step 1: verify OTP — get access token + user
      const res = await api.post<{
        data: { tokens: { accessToken: string }; user: { _id: string; name: string; phone: string; role: string } };
      }>('/auth/otp/verify', { phone: phoneNum, otp, purpose: 'LOGIN' });

      const token = res.data.tokens.accessToken;
      const user = res.data.user;

      // Step 2: fetch driver profile to verify driver authorization
      let driverProfile = { _id: user._id, name: user.name, phone: user.phone, status: 'AVAILABLE', driverCode: '' };
      try {
        const dRes = await api.get<{
          data: { _id: string; name: string; phone: string; status: string; driverCode: string };
        }>('/drivers/me', token);
        if (dRes && dRes.data) {
          driverProfile = {
            _id: dRes.data._id || user._id,
            name: dRes.data.name || user.name,
            phone: dRes.data.phone || user.phone,
            status: dRes.data.status || 'AVAILABLE',
            driverCode: dRes.data.driverCode || '',
          };
        }
      } catch (err: unknown) {
        if (user.role !== 'DRIVER' && user.role !== 'SUPER_ADMIN' && user.role !== 'ASSOCIATION_ADMIN') {
          setError('This number is not registered as an authorized driver. Please contact the association admin.');
          setLoading(false);
          return;
        }
      }

      onLogin(token, driverProfile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-950 text-slate-100">
      {/* Brand Header */}
      <div className="mb-8 text-center space-y-2">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-[0_8px_30px_rgba(16,185,129,0.3)] border border-emerald-400/40">
          <Car className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Driver Partner App</h1>
          <p className="text-xs text-slate-400 mt-0.5">Sri Mookambika Tourist Taxi Association</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {step === 'phone' ? (
          <>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-bold">
                Registered Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="px-3.5 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 font-mono font-bold text-sm flex items-center shrink-0">
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
                  className="input-field flex-1 text-lg font-mono tracking-wider bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:border-emerald-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleRequestOTP}
              disabled={loading || phone.length < 10}
              className="btn-primary w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Sending Verification Code...' : 'Continue to Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="text-center space-y-1">
              <div className="text-slate-300 text-xs">
                Verification OTP sent to <span className="font-bold text-white font-mono">+91 {phone}</span>
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
                <span>Change mobile number</span>
              </button>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-bold text-center">
                Enter 6-digit Verification Code
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                placeholder="123456"
                onChange={e => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                className="w-full text-center text-3xl tracking-widest font-mono py-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-white outline-none focus:border-emerald-500"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              />
              <div className="mt-2 text-center text-xs text-amber-400/90 bg-amber-950/40 border border-amber-800/40 rounded-xl py-2 px-3 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Dev Mode: Enter <strong>123456</strong>
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs text-center justify-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length < 6}
              className="btn-primary w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Verifying...' : 'Sign In as Driver Partner'}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                onClick={handleRequestOTP}
                disabled={loading || resendCooldown > 0}
                className="text-xs text-slate-400 hover:text-white disabled:opacity-50"
              >
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
