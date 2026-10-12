import { useState, useEffect } from 'react';
import { Phone, Shield, X, MapPin, CheckCircle2, AlertCircle, Share2, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export interface ActiveBookingData {
  _id: string;
  bookingNumber: string;
  status: string;
  pickupLocation: { address: string };
  dropLocation?: { address: string };
  vehicleCategoryId?: { name: string; code?: string };
  fareSnapshot?: { total: number };
  assignedDriverId?: { name: string; phone: string; rating?: number };
  assignedVehicleId?: { registrationNumber?: string; brand?: string; vehicleModel?: string; color?: string };
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
    switch (booking.status) {
      case 'PENDING':
      case 'SEARCHING_DRIVER':
        return {
          title: 'Finding your driver...',
          subtitle: 'Connecting with nearby taxi stand drivers',
          color: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'DRIVER_ASSIGNED':
      case 'DRIVER_ACCEPTED':
      case 'DRIVER_ARRIVING':
        return {
          title: 'Driver is on the way',
          subtitle: 'Arriving at pickup in ~3 mins',
          color: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'DRIVER_ARRIVED':
      case 'ARRIVED':
        return {
          title: 'Driver arrived at pickup!',
          subtitle: 'Look for your vehicle outside',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'TRIP_STARTED':
      case 'TRIP_IN_PROGRESS':
        return {
          title: 'Trip in progress',
          subtitle: 'Drive safely to your destination',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'TRIP_COMPLETED':
      case 'COMPLETED':
        return {
          title: 'Trip Completed!',
          subtitle: 'Thank you for riding with Go Mookambika',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      default:
        return {
          title: booking.status,
          subtitle: 'Status updated',
          color: 'bg-neutral-100 text-neutral-800 border-neutral-200',
        };
    }
  };

  const badge = getStatusBadge();
  const driverName = booking.assignedDriverId?.name || 'Assigned Driver';
  const driverPhone = booking.assignedDriverId?.phone || '+919876543210';
  const plateNumber = booking.assignedVehicleId?.registrationNumber || 'KA 20 AB 1234';
  const vehicleName = `${booking.assignedVehicleId?.brand || 'Maruti'} ${booking.assignedVehicleId?.vehicleModel || 'Dzire'}`;

  return (
    <div className="w-full bg-white rounded-3xl p-5 shadow-2xl border border-neutral-200 space-y-4 text-black uber-slide-up">
      {/* Top Status & Booking Number */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
              Live Trip
            </span>
          </div>
          <h3 className="font-bold text-lg text-neutral-900 mt-0.5">{badge.title}</h3>
          <p className="text-xs text-neutral-500">{badge.subtitle}</p>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-neutral-400 font-mono">Trip ID</div>
          <div className="font-mono font-bold text-xs text-neutral-800">{booking.bookingNumber}</div>
        </div>
      </div>

      {/* Ride Start PIN / OTP Box */}
      <div className="p-3.5 bg-neutral-900 text-white rounded-2xl flex items-center justify-between shadow-md">
        <div>
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Ride Start PIN
          </div>
          <div className="text-2xl font-black font-mono tracking-widest text-emerald-400 mt-0.5">
            123456
          </div>
        </div>
        <div className="text-right text-[11px] text-neutral-400 max-w-[150px] leading-snug">
          Share this PIN with your driver to start the trip
        </div>
      </div>

      {/* Driver & Vehicle Profile Card */}
      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
        {/* Left: Driver avatar & name */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg shrink-0">
            {driverName[0]}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-neutral-900 truncate">{driverName}</h4>
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-0.5">
              <span className="text-amber-500 font-bold">★ 4.9</span>
              <span>•</span>
              <span className="truncate">{vehicleName}</span>
            </div>
            <div className="inline-block mt-1 px-2 py-0.5 bg-white border border-neutral-300 rounded font-mono font-bold text-xs text-neutral-800 tracking-wider">
              {plateNumber}
            </div>
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

      {/* Fare Summary */}
      {booking.fareSnapshot?.total && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
          <span className="text-neutral-500 font-medium">Estimated Fare</span>
          <span className="font-black text-base text-neutral-900 font-mono">
            ₹{Math.round(booking.fareSnapshot.total)}
          </span>
        </div>
      )}

      {cancelError && (
        <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
          {cancelError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <a
          href={`tel:${driverPhone}`}
          className="py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-neutral-200"
        >
          <Phone className="w-4 h-4 text-emerald-600" />
          <span>Call Driver</span>
        </a>

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
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors text-center font-medium"
      >
        Close Live View
      </button>
    </div>
  );
}
