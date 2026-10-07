import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AuthState { token: string | null; }
interface BookingPageProps { auth: AuthState; onBack: () => void; }

interface VehicleCategory {
  _id: string;
  name: string;
  code: string;
  seatCapacity: number;
  ac: boolean;
  baseFare: number;
  ratePerKm: number;
  description?: string;
}

interface FareEstimate {
  total: number;
  baseFare: number;
  distanceFare: number;
  distanceKm: number;
  nightCharge?: number;
  currency: string;
}

type BookingStep = 'pickup' | 'drop' | 'category' | 'fare' | 'confirm' | 'success';

export function BookingPage({ auth, onBack }: BookingPageProps) {
  const [step, setStep] = useState<BookingStep>('pickup');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | null>(null);
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingNumber, setBookingNumber] = useState('');
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Try to get user location
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
    // Load vehicle categories
    api.get<{ data: VehicleCategory[] }>('/vehicles/categories', auth)
      .then(r => setCategories(r.data ?? []))
      .catch(() => {});
  }, [auth]);

  const handleGetFareEstimate = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    setError('');
    try {
      // Use placeholder coords if no real geocoding available
      const res = await api.post<{ data: FareEstimate }>('/fare/estimate', {
        pickupLatitude: userLocation?.lat ?? 13.3398,
        pickupLongitude: userLocation?.lng ?? 74.7441,
        dropLatitude: 13.3500,
        dropLongitude: 74.7600,
        vehicleCategoryId: selectedCategory._id,
        tripType: 'OUTSTATION',
      }, auth);
      setFareEstimate(res.data);
      setStep('fare');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to estimate fare');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ data: { bookingNumber: string } }>('/bookings', {
        tripType: 'OUTSTATION',
        pickupLocation: {
          latitude: userLocation?.lat ?? 13.3398,
          longitude: userLocation?.lng ?? 74.7441,
          address: pickup,
        },
        dropLocation: drop ? {
          latitude: 13.3500,
          longitude: 74.7600,
          address: drop,
        } : undefined,
        vehicleCategoryId: selectedCategory._id,
        passengers: 1,
        paymentOption: 'PAY_AT_END',
      }, auth);
      setBookingNumber(res.data.bookingNumber);
      setStep('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(15,17,26)] safe-area-top">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">Book a Cab</h1>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-1 px-5 mb-6">
        {(['pickup', 'drop', 'category', 'fare', 'confirm'] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              ['pickup', 'drop', 'category', 'fare', 'confirm', 'success'].indexOf(step) >= i
                ? 'bg-blue-500'
                : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div className="px-5 space-y-4">
        {/* Success */}
        {step === 'success' && (
          <div className="text-center py-8 fade-in">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h2>
            <div className="text-gray-400 mb-4">Your booking number is</div>
            <div className="font-mono text-blue-400 text-2xl font-bold mb-6">{bookingNumber}</div>
            <p className="text-gray-400 text-sm mb-8">We're finding the nearest driver for you. You'll be notified soon.</p>
            <button onClick={onBack} className="btn-primary">Go to Home</button>
          </div>
        )}

        {/* Pickup */}
        {step === 'pickup' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">📍 Pickup Location</label>
              <input
                type="text"
                placeholder="Enter pickup address or use current location"
                value={pickup}
                onChange={e => setPickup(e.target.value)}
                className="input-field"
                autoFocus
              />
              {userLocation && (
                <button
                  onClick={() => setPickup('My Current Location')}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                >
                  📍 Use current location
                </button>
              )}
            </div>
            <button
              onClick={() => { if (pickup.trim()) setStep('drop'); }}
              disabled={!pickup.trim()}
              className="btn-primary"
            >
              Next →
            </button>
          </>
        )}

        {/* Drop */}
        {step === 'drop' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">🏁 Drop Location (Optional)</label>
              <input
                type="text"
                placeholder="Where are you going?"
                value={drop}
                onChange={e => setDrop(e.target.value)}
                className="input-field"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('pickup')} className="btn-secondary flex-1">← Back</button>
              <button onClick={() => setStep('category')} className="btn-primary flex-1">Next →</button>
            </div>
          </>
        )}

        {/* Category Selection */}
        {step === 'category' && (
          <>
            <h2 className="text-white font-semibold">Choose Vehicle Type</h2>
            {categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Loading categories...</div>
            ) : (
              <div className="space-y-3">
                {categories.map(cat => (
                  <button
                    key={cat._id}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left card transition-all active:scale-98 ${
                      selectedCategory?._id === cat._id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{cat.name}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          💺 {cat.seatCapacity} seats · {cat.ac ? '❄️ AC' : '🌬️ Non-AC'}
                        </div>
                        {cat.description && (
                          <div className="text-xs text-gray-500 mt-1">{cat.description}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-white font-bold">₹{cat.baseFare}</div>
                        <div className="text-xs text-gray-400">+ ₹{cat.ratePerKm}/km</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep('drop')} className="btn-secondary flex-1">← Back</button>
              <button
                onClick={handleGetFareEstimate}
                disabled={!selectedCategory || loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Estimating...' : 'Get Fare →'}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </>
        )}

        {/* Fare Estimate */}
        {step === 'fare' && fareEstimate && (
          <>
            <div className="card">
              <h3 className="text-white font-semibold mb-4">Fare Estimate</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Distance</span>
                  <span className="text-white">{fareEstimate.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Fare</span>
                  <span className="text-white">₹{fareEstimate.baseFare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Distance Fare</span>
                  <span className="text-white">₹{fareEstimate.distanceFare.toFixed(2)}</span>
                </div>
                {fareEstimate.nightCharge && fareEstimate.nightCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Night Charge</span>
                    <span className="text-white">₹{fareEstimate.nightCharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 flex justify-between">
                  <span className="text-white font-semibold">Estimated Total</span>
                  <span className="text-green-400 font-bold text-lg">₹{fareEstimate.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="card text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <span>ℹ️</span>
                <p>Final fare may vary based on actual distance and wait time. No surge pricing.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('category')} className="btn-secondary flex-1">← Back</button>
              <button onClick={() => setStep('confirm')} className="btn-primary flex-1">Confirm Booking →</button>
            </div>
          </>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <>
            <div className="card space-y-4">
              <h3 className="text-white font-semibold">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="text-green-400 mt-0.5">📍</span>
                  <div>
                    <div className="text-gray-400 text-xs">Pickup</div>
                    <div className="text-white">{pickup}</div>
                  </div>
                </div>
                {drop && (
                  <div className="flex gap-3">
                    <span className="text-red-400 mt-0.5">🏁</span>
                    <div>
                      <div className="text-gray-400 text-xs">Drop</div>
                      <div className="text-white">{drop}</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className="text-blue-400 mt-0.5">🚖</span>
                  <div>
                    <div className="text-gray-400 text-xs">Vehicle</div>
                    <div className="text-white">{selectedCategory?.name}</div>
                  </div>
                </div>
                {fareEstimate && (
                  <div className="flex gap-3">
                    <span className="text-green-400 mt-0.5">💰</span>
                    <div>
                      <div className="text-gray-400 text-xs">Est. Fare</div>
                      <div className="text-white">₹{fareEstimate.total.toFixed(2)}</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className="text-purple-400 mt-0.5">💳</span>
                  <div>
                    <div className="text-gray-400 text-xs">Payment</div>
                    <div className="text-white">Pay at End</div>
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep('fare')} className="btn-secondary flex-1">← Back</button>
              <button onClick={handleConfirmBooking} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Booking...' : '✓ Confirm Booking'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
