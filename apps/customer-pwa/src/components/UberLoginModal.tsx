import { useState } from 'react';
import { X, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

interface UberLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string, user: { name?: string; phone: string }) => void;
  title?: string;
  subtitle?: string;
}

export function UberLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  title = 'Enter your mobile number',
  subtitle = "We'll send a 6-digit verification code to your phone",
}: UberLoginModalProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 10) return digits;
    return digits.slice(-10);
  };

  const handleRequestOTP = async (customPhone?: string) => {
    const targetPhone = customPhone || phone;
    const phoneNum = `+91${targetPhone}`;
    if (!/^\+91[6-9]\d{9}$/.test(phoneNum)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { phone: phoneNum, purpose: 'LOGIN' });
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (customOtp?: string) => {
    const targetOtp = customOtp || otp;
    if (targetOtp.length !== 6) {
      setError('Enter 6-digit OTP');
      return;
    }
    const phoneNum = `+91${phone}`;
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{
        data: {
          tokens: { accessToken: string; refreshToken?: string };
          user: { name?: string; phone: string };
        };
      }>('/auth/otp/verify', { phone: phoneNum, otp: targetOtp, purpose: 'LOGIN' });

      const token = res.data?.tokens?.accessToken;
      const user = res.data?.user || { phone: phoneNum, name: 'Customer' };
      if (token) {
        onLoginSuccess(token, user);
        onClose();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
      {/* Modal / Bottom Sheet Box */}
      <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden uber-slide-up text-black flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {step === 'otp' ? (
              <button
                onClick={() => {
                  setStep('phone');
                  setError('');
                }}
                className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-800" />
              </button>
            ) : null}
            <span className="font-black text-xl tracking-tight">Go Mookambika</span>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-neutral-700" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6 overflow-y-auto">
          {step === 'phone' ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 leading-snug">{title}</h2>
                <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
              </div>

              {/* Mobile Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Mobile number
                </label>
                <div className="flex items-center gap-2 border-2 border-neutral-200 focus-within:border-black rounded-xl px-3 py-2.5 transition-colors bg-white">
                  <div className="flex items-center gap-1.5 pr-2 border-r border-neutral-200 text-sm font-semibold text-neutral-800 shrink-0">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => {
                      setPhone(formatPhone(e.target.value));
                      setError('');
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
                    className="w-full text-base font-medium outline-none bg-transparent placeholder:text-neutral-400 text-black tracking-wide"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <button
                onClick={() => handleRequestOTP()}
                disabled={loading || phone.length < 10}
                className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Continue</span>}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 pt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
                <span>By continuing, you agree to receive SMS for trip verification</span>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 leading-snug">
                  Enter 6-digit code
                </h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Sent to <span className="font-semibold text-neutral-800">+91 {phone}</span>
                </p>
              </div>

              {/* OTP Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Verification Code
                </label>
                <input
                  type="tel"
                  maxLength={6}
                  value={otp}
                  onChange={e => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setOtp(clean);
                    setError('');
                    if (clean.length === 6) {
                      handleVerifyOTP(clean);
                    }
                  }}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold py-3 border-2 border-neutral-200 focus:border-black rounded-xl outline-none transition-colors"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <button
                onClick={() => handleVerifyOTP()}
                disabled={loading || otp.length < 6}
                className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Verify & Continue</span>}
              </button>

              <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                <button
                  type="button"
                  onClick={() => handleRequestOTP()}
                  className="text-black font-semibold hover:underline"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError('');
                  }}
                  className="hover:underline"
                >
                  Change phone number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
