import { useState, useEffect } from 'react';
import {
  Phone,
  X,
  QrCode,
  Loader2,
  CheckCircle2,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Clock,
  Car,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';

export interface ActiveBookingData {
  _id: string;
  bookingNumber: string;
  status: string;
  startOTP?: string;
  scheduledAt?: string;
  pickupLocation: { address: string };
  dropLocation?: { address: string };
  vehicleCategoryId?: { name: string; code?: string };
  fareSnapshot?: { total: number };
  paymentOption?: string;
  paymentStatus?: string;
  assignedDriverId?: {
    name: string;
    phone: string;
    rating?: number;
    upiId?: string;
    upiBeneficiaryName?: string;
  };
  assignedVehicleId?: {
    registrationNumber?: string;
    brand?: string;
    vehicleModel?: string;
    color?: string;
  };
  createdAt?: string;
}

interface UberTripTrackingProps {
  booking: ActiveBookingData;
  onClose: () => void;
  onRefresh?: () => void;
}

export function UberTripTracking({
  booking,
  onClose,
  onRefresh,
}: UberTripTrackingProps) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // QR data URLs
  const [startQrDataUrl, setStartQrDataUrl] = useState<string>('');
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string>('');
  const [showStartQrModal, setShowStartQrModal] = useState(false);

  // Customer payment choice: only UPI and CASH
  const [customerPaymentMethod, setCustomerPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');

  const otpCode = booking.startOTP || '';
  const fareAmount = Math.max(1, Math.round(booking.fareSnapshot?.total || 0));

  const driverName = booking.assignedDriverId?.name || '';
  const driverPhone = booking.assignedDriverId?.phone || '';
  const driverUpiId = booking.assignedDriverId?.upiId || '';
  const driverPayeeName = booking.assignedDriverId?.upiBeneficiaryName || driverName || 'Go Mookambika Captain';

  const plateNumber = booking.assignedVehicleId?.registrationNumber || '';
  const vehicleName =
    [booking.assignedVehicleId?.brand, booking.assignedVehicleId?.vehicleModel].filter(Boolean).join(' ') ||
    booking.vehicleCategoryId?.name ||
    'Cab';

  // Trip stage helpers
  const isTripCompleted = booking.status === 'TRIP_COMPLETED' || booking.status === 'COMPLETED';
  const isTripInProgress = booking.status === 'TRIP_STARTED' || booking.status === 'TRIP_IN_PROGRESS';
  const isPreTrip = !isTripCompleted && !isTripInProgress;
  const isPaid = booking.paymentStatus === 'PAID';

  // UPI deep link URL
  const upiPaymentUri = driverUpiId
    ? `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(
        driverPayeeName
      )}&am=${fareAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
        `Go Mookambika Trip ${booking.bookingNumber}`
      )}`
    : '';

  // Generate Start Ride QR Code (for Captain to scan & verify OTP)
  useEffect(() => {
    if (!isPreTrip || !otpCode) return;
    const payload = JSON.stringify({
      type: 'GO_MOOKAMBIKA_RIDE',
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      otp: otpCode,
    });

    QRCode.toDataURL(payload, {
      width: 260,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(url => setStartQrDataUrl(url))
      .catch(() => {});
  }, [booking._id, booking.bookingNumber, otpCode, isPreTrip]);

  // Generate Dynamic Payment UPI QR Code (for Customer to scan & pay exact amount)
  useEffect(() => {
    if (!isTripCompleted || !upiPaymentUri) return;

    QRCode.toDataURL(upiPaymentUri, {
      width: 280,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(url => setPaymentQrDataUrl(url))
      .catch(() => {});
  }, [upiPaymentUri, isTripCompleted]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setCancelling(true);
    setCancelError('');
    try {
      await api.post(`/bookings/${booking._id}/cancel`, {});
      if (onRefresh) onRefresh();
      onClose();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = () => {
    // If booking is scheduled for the future and driver has not yet been assigned
    if (booking.scheduledAt && (!booking.assignedDriverId || booking.status === 'CONFIRMED')) {
      const d = new Date(booking.scheduledAt);
      const formatted = !isNaN(d.getTime())
        ? d.toLocaleString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : booking.scheduledAt;
      return {
        title: `Trip Scheduled • ${formatted}`,
        subtitle: 'Driver will be assigned from taxi stand queue on trip start date',
        color: 'bg-indigo-600',
      };
    }

    switch (booking.status) {
      case 'CONFIRMED':
        return {
          title: 'Booking Confirmed',
          subtitle: 'Dispatching driver from taxi stand queue',
          color: 'bg-blue-500',
        };
      case 'PENDING':
      case 'SEARCHING_DRIVER':
        return {
          title: 'Finding your driver...',
          subtitle: 'Connecting with nearby taxi stand drivers',
          color: 'bg-amber-500',
        };
      case 'DRIVER_ASSIGNED':
      case 'DRIVER_ACCEPTED':
      case 'DRIVER_ARRIVING':
        return {
          title: 'Driver is on the way',
          subtitle: 'Arriving at pickup point',
          color: 'bg-blue-500',
        };
      case 'DRIVER_ARRIVED':
      case 'ARRIVED':
        return {
          title: 'Driver arrived at pickup!',
          subtitle: 'Vehicle is waiting for you',
          color: 'bg-emerald-500',
        };
      case 'TRIP_STARTED':
      case 'TRIP_IN_PROGRESS':
        return {
          title: 'Ride in progress',
          subtitle: 'En route safely to your destination',
          color: 'bg-indigo-500',
        };
      case 'TRIP_COMPLETED':
      case 'COMPLETED':
        return {
          title: isPaid ? 'Trip Completed & Settled' : 'Trip Completed • Payment Due',
          subtitle: isPaid ? 'Payment successfully recorded' : 'Please settle the trip fare with Captain',
          color: isPaid ? 'bg-emerald-500' : 'bg-amber-500',
        };
      default:
        return {
          title: booking.status,
          subtitle: 'Trip updated',
          color: 'bg-neutral-500',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="w-full bg-white rounded-3xl p-5 shadow-2xl border border-neutral-200 space-y-4 text-black uber-slide-up">
      {/* Top Status & Booking Number */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${badge.color} animate-ping`} />
            <span className="text-xs font-black uppercase tracking-wider text-neutral-800">
              {isTripCompleted ? 'Trip Summary' : 'Live Trip'}
            </span>
          </div>
          <h3 className="font-bold text-lg text-neutral-900 mt-0.5">{badge.title}</h3>
          <p className="text-xs text-neutral-500">{badge.subtitle}</p>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-neutral-400 font-mono">Trip ID</div>
          <div className="font-mono font-bold text-xs text-neutral-800">{booking.bookingNumber}</div>
          {onRefresh && (
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="mt-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 justify-end ml-auto"
              title="Refresh trip status"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── CASE 1: TRIP COMPLETED -> CASH / UPI PAYMENT SETTLEMENT ─── */}
      {isTripCompleted && (
        <div className="space-y-4">
          {/* Total Fare Amount Banner */}
          <div className="p-4 bg-gradient-to-br from-neutral-900 via-slate-900 to-black text-white rounded-3xl shadow-xl border border-neutral-800 text-center relative overflow-hidden">
            <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">
              Total Amount to Pay
            </div>
            <div className="text-4xl font-black text-emerald-400 font-mono my-1 tracking-tight">
              ₹{fareAmount}
            </div>
            <div className="text-[11px] text-neutral-300">
              Payable to Captain {driverName}
            </div>

            {isPaid && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Payment Confirmed ({booking.paymentOption === 'UPI' ? 'UPI' : 'Cash'})</span>
              </div>
            )}
          </div>

          {!isPaid ? (
            <div className="space-y-3">
              {/* Payment Mode Selector: ONLY UPI & CASH */}
              <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCustomerPaymentMethod('UPI')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    customerPaymentMethod === 'UPI'
                      ? 'bg-black text-white shadow-md'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI (QR / App)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerPaymentMethod('CASH')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    customerPaymentMethod === 'CASH'
                      ? 'bg-black text-white shadow-md'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Pay with Cash</span>
                </button>
              </div>

              {/* UPI Tab: Dynamic Total Amount QR Code & Direct Intent */}
              {customerPaymentMethod === 'UPI' && (
                driverUpiId ? (
                  <div className="p-4 bg-slate-950 text-white rounded-3xl border border-indigo-500/30 shadow-xl space-y-3.5 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      <QrCode className="w-4 h-4" />
                      <span>Scan & Pay via any UPI App</span>
                    </div>

                    {/* Dynamic Amount QR Code */}
                    <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-lg border-2 border-indigo-500/40">
                      {paymentQrDataUrl ? (
                        <img
                          src={paymentQrDataUrl}
                          alt="UPI Payment QR Code"
                          className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-neutral-400">
                          <Loader2 className="w-6 h-6 animate-spin text-neutral-900" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-neutral-300 font-semibold">
                        Exact amount <span className="text-emerald-400 font-mono font-bold">₹{fareAmount}</span> is encoded in QR
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        Pay to UPI ID: <span className="text-white font-bold">{driverUpiId}</span>
                      </div>
                    </div>

                    {/* Mobile Deep Link */}
                    <a
                      href={upiPaymentUri}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Pay with UPI App (GPay / PhonePe / Paytm)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div className="text-[10px] text-neutral-400">
                      After paying, Captain will verify payment and conclude the ride.
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-neutral-900 text-white rounded-3xl border border-neutral-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Direct Cash Settlement</h4>
                      <p className="text-xs text-neutral-400 mt-1">
                        Captain has not linked a personal UPI ID. Please settle ₹{fareAmount} via Cash directly to Captain.
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* CASH Tab: Cash handover instructions */}
              {customerPaymentMethod === 'CASH' && (
                <div className="p-5 bg-amber-50 rounded-3xl border border-amber-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-700">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-amber-950">Pay Cash Directly</h4>
                    <p className="text-xs text-amber-800 mt-1">
                      Please hand over physical cash of{' '}
                      <span className="font-mono font-black text-amber-900 text-sm">₹{fareAmount}</span> to{' '}
                      <span className="font-bold">{driverName}</span>.
                    </p>
                  </div>
                  <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                    Captain will mark cash received on their device to complete the ride.
                  </div>
                </div>
              )}

              {/* Waiting status reminder */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-100 border border-neutral-200 text-xs">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                  <span>Waiting for Captain to confirm...</span>
                </div>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 bg-white hover:bg-neutral-50 text-neutral-800 font-bold rounded-lg border border-neutral-300 text-[11px] shadow-sm flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Check</span>
                </button>
              </div>
            </div>
          ) : (
            /* Paid Receipt confirmation */
            <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-emerald-950">Payment Settled!</h4>
              <p className="text-xs text-emerald-800">
                Thank you for traveling with Go Mookambika. Have a blessed journey ahead!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── CASE 2: TRIP IN PROGRESS -> LIVE ROUTE / DESTINATION REMINDER ─── */}
      {isTripInProgress && (
        <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/30 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
            <Car className="w-4 h-4 animate-bounce" />
            <span>Ride is in Progress</span>
          </div>
          <p className="text-xs text-neutral-600">
            Sit back and relax. Your Captain is driving you to your destination safely.
          </p>
        </div>
      )}

      {/* ─── CASE 3: PRE-TRIP -> 6-DIGIT START OTP & START QR CODE ─── */}
      {isPreTrip && (
        <div className="p-4 bg-slate-950 text-white rounded-3xl border border-emerald-500/30 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                Trip Verification Code
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Share PIN or show QR</span>
          </div>

          {/* Scheduled Trip Notice */}
          {booking.scheduledAt && !booking.assignedDriverId && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-left space-y-1">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wide">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Scheduled Ride Confirmed</span>
              </div>
              <div className="text-sm font-bold text-white">
                Pickup: {new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                Your booking is registered in advance. On the trip start date, the taxi stand queue system will automatically assign the next driver in queue to your pickup point.
              </p>
            </div>
          )}

          {/* 6-Digit PIN Display */}
          <div className="space-y-1.5 text-center">
            <div className="text-[11px] text-slate-400 font-medium">
              Share this 6-digit Ride PIN with your Captain
            </div>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 pt-1">
              {otpCode.padEnd(6, '0').slice(0, 6).split('').map((digit, idx) => (
                <span
                  key={idx}
                  className="w-10 h-12 flex items-center justify-center bg-slate-900 border border-emerald-500/40 rounded-xl text-emerald-400 font-mono font-black text-2xl shadow-inner tracking-tight select-all"
                >
                  {digit}
                </span>
              ))}
            </div>
          </div>

          {/* QR Code Action Card */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {startQrDataUrl ? (
                <div
                  onClick={() => setShowStartQrModal(true)}
                  className="w-14 h-14 bg-white p-1 rounded-xl shadow cursor-pointer shrink-0 hover:scale-105 transition-transform"
                  title="Click to expand QR Code"
                >
                  <img src={startQrDataUrl} alt="Ride QR Code" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                  <QrCode className="w-6 h-6 animate-pulse" />
                </div>
              )}
              <div className="min-w-0">
                <h5 className="font-bold text-xs text-white">Ride Start QR Code</h5>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Captain can scan this QR code directly to begin ride
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStartQrModal(true)}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show QR</span>
            </button>
          </div>
        </div>
      )}

      {/* Driver & Vehicle Profile Card */}
      {booking.assignedDriverId ? (
        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
          {/* Left: Driver avatar & name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg shrink-0">
              {driverName[0]?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-neutral-900 truncate">{driverName}</h4>
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-0.5">
                {typeof booking.assignedDriverId.rating === 'number' && booking.assignedDriverId.rating > 0 && (
                  <>
                    <span className="text-amber-500 font-bold">★ {booking.assignedDriverId.rating.toFixed(1)}</span>
                    <span>•</span>
                  </>
                )}
                <span className="truncate">{vehicleName}</span>
              </div>
              {plateNumber && (
                <div className="inline-block mt-1 px-2 py-0.5 bg-white border border-neutral-300 rounded font-mono font-bold text-xs text-neutral-800 tracking-wider">
                  {plateNumber}
                </div>
              )}
            </div>
          </div>

          {/* Right: Isometric Vehicle Illustration */}
          <div className="w-16 h-12 shrink-0 flex items-center justify-center">
            <img
              src="/images/SedanComfort.png"
              alt="Vehicle"
              className="max-h-full max-w-full object-contain filter drop-shadow-sm"
            />
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-neutral-900">
              {booking.scheduledAt ? 'Advance Booking Confirmed' : 'Queue Assignment in Progress'}
            </h4>
            <p className="text-[11px] text-neutral-500">
              {booking.scheduledAt
                ? 'Captain will be assigned from taxi stand queue on pickup date'
                : 'Next Captain in queue will be assigned to your ride'}
            </p>
          </div>
        </div>
      )}

      {/* Route Details */}
      <div className="space-y-2 py-1 text-xs">
        <div className="flex items-start gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-black mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-neutral-400 block text-[10px] uppercase font-bold">Pickup</span>
            <span className="text-neutral-800 font-medium truncate block">
              {booking.pickupLocation.address}
            </span>
          </div>
        </div>

        {booking.dropLocation && (
          <div className="flex items-start gap-2.5">
            <div className="w-3.5 h-3.5 rounded-sm bg-black mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-neutral-400 block text-[10px] uppercase font-bold">Destination</span>
              <span className="text-neutral-800 font-medium truncate block">
                {booking.dropLocation.address}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Fare Summary (when not completed, as completed has prominent top banner) */}
      {!isTripCompleted && booking.fareSnapshot?.total && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
          <span className="text-neutral-500 font-medium">Estimated Fare</span>
          <span className="font-black text-base text-neutral-900 font-mono">
            ₹{fareAmount}
          </span>
        </div>
      )}

      {cancelError && (
        <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
          {cancelError}
        </div>
      )}

      {/* Action Buttons: Call Driver & Cancel (Cancel only before trip start) */}
      <div className={`grid ${isPreTrip ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 pt-1`}>
        {booking.assignedDriverId?.phone ? (
          <a
            href={`tel:${booking.assignedDriverId.phone}`}
            className="py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-neutral-200"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>Call Captain</span>
          </a>
        ) : (
          <div className="py-3 bg-neutral-100 text-neutral-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-neutral-200 select-none">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span>Captain assigning...</span>
          </div>
        )}

        {isPreTrip && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="py-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-red-200 disabled:opacity-50"
          >
            {cancelling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <X className="w-4 h-4 text-red-600" />
                <span>Cancel Ride</span>
              </>
            )}
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors text-center font-medium"
      >
        {isPaid ? 'Close & Book Another Ride' : 'Close Live View'}
      </button>

      {/* Fullscreen High-Contrast Customer Start QR Modal */}
      {showStartQrModal && (
        <div
          onClick={() => setShowStartQrModal(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-scale-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="text-left">
                <h4 className="font-bold text-base text-neutral-900">Ride Verification QR</h4>
                <p className="text-xs text-neutral-500 font-mono">Trip #{booking.bookingNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartQrModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* High-visibility QR image */}
            <div className="p-3 bg-white border-2 border-neutral-900 rounded-2xl shadow-md inline-block mx-auto">
              {startQrDataUrl && (
                <img
                  src={startQrDataUrl}
                  alt="Full Ride QR Code"
                  className="w-56 h-56 object-contain mx-auto"
                />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-neutral-600 font-medium">Or provide 6-Digit PIN:</div>
              <div className="font-mono font-black text-2xl tracking-[0.25em] text-neutral-900 bg-neutral-100 py-1.5 rounded-xl border border-neutral-200">
                {otpCode}
              </div>
            </div>

            <p className="text-[11px] text-neutral-400">
              Captain will scan this QR or type the PIN to start the ride
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

