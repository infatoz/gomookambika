import { useState } from 'react';
import { api } from '@/lib/api';

interface OTPLoginPageProps {
  onLogin: (token: string, driver: { _id: string; name: string; phone: string; status: string; driverCode: string }) => void;
}

export function OTPLoginPage({ onLogin }: OTPLoginPageProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOTP = async () => {
    const phoneNum = `+91${phone}`;
    if (!/^\+91[6-9]\d{9}$/.test(phoneNum)) { setError('Enter valid 10-digit mobile'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/otp/request', { phone: phoneNum, purpose: 'LOGIN' });
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    const phoneNum = `+91${phone}`;
    setError(''); setLoading(true);
    try {
      // Step 1: verify OTP — get access token + user
      const res = await api.post<{
        data: { tokens: { accessToken: string }; user: { _id: string; name: string; phone: string; role: string } }
      }>('/auth/otp/verify', { phone: phoneNum, otp, purpose: 'LOGIN' });
      const token = res.data.tokens.accessToken;
      const user = res.data.user;

      // Step 2: fetch driver profile to get driverCode / status
      let driverProfile = { _id: user._id, name: user.name, phone: user.phone, status: 'AVAILABLE', driverCode: '' };
      try {
        const dRes = await api.get<{ data: { _id: string; name: string; phone: string; status: string; driverCode: string } }>('/drivers/me', token);
        driverProfile = dRes.data;
      } catch { /* driver profile fetch failed, use user data */ }

      onLogin(token, driverProfile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[rgb(15,17,26)]">
      <div className="mb-10 text-center">
        <div className="text-6xl mb-4">🚖</div>
        <h1 className="text-3xl font-bold text-white mb-2">Driver App</h1>
        <p className="text-gray-400">Go Mookambika Taxi Association</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {step === 'phone' ? (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Mobile Number</label>
              <div className="flex gap-2">
                <div className="input-field !w-auto px-3 text-white flex items-center gap-1 shrink-0">🇮🇳 +91</div>
                <input
                  type="tel" inputMode="numeric" maxLength={10}
                  placeholder="9876543210" value={phone}
                  onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                  className="input-field flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleRequestOTP} disabled={loading || phone.length < 10} className="btn-primary">
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="text-gray-400 text-sm">OTP sent to +91 {phone}</div>
              <button onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="text-green-400 text-sm hover:underline mt-1">
                Change number
              </button>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Enter OTP</label>
              <input
                type="tel" inputMode="numeric" maxLength={6}
                value={otp} placeholder="______"
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                className="input-field text-center text-2xl tracking-widest font-mono"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={handleVerifyOTP} disabled={loading || otp.length < 6} className="btn-primary">
              {loading ? 'Verifying...' : 'Sign In →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
