import { useState } from 'react';
import { api } from '@/lib/api';

interface OTPLoginPageProps {
  onLogin: (token: string, user: { name?: string; phone: string }) => void;
}

export function OTPLoginPage({ onLogin }: OTPLoginPageProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 10) return digits;
    return digits.slice(-10);
  };

  const handleRequestOTP = async () => {
    const phoneNum = `+91${phone}`;
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
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    const phoneNum = `+91${phone}`;
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{
        data: { tokens: { accessToken: string }; user: { name?: string; phone: string } }
      }>('/auth/otp/verify', { phone: phoneNum, otp, purpose: 'LOGIN' });
      onLogin(res.data.tokens.accessToken, res.data.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[rgb(15,17,26)]">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="text-6xl mb-4">🚖</div>
        <h1 className="text-3xl font-bold text-white mb-2">Go Mookambika</h1>
        <p className="text-gray-400">Your trusted taxi service</p>
      </div>

      <div className="w-full max-w-sm space-y-4 fade-in">
        {step === 'phone' ? (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Mobile Number</label>
              <div className="flex gap-2">
                <div className="input-field !w-auto px-3 text-white flex items-center gap-1 shrink-0">
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => { setPhone(formatPhone(e.target.value)); setError(''); }}
                  className="input-field flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleRequestOTP}
              disabled={loading || phone.length < 10}
              className="btn-primary"
            >
              {loading ? 'Sending OTP...' : 'Send OTP →'}
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-2">
              <div className="text-gray-400 text-sm">OTP sent to +91 {phone}</div>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                className="text-blue-400 text-sm hover:underline mt-1"
              >
                Change number
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Enter 6-digit OTP</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="______"
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                className="input-field text-center text-2xl tracking-widest font-mono"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length < 6}
              className="btn-primary"
            >
              {loading ? 'Verifying...' : 'Verify OTP →'}
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-gray-600 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}
