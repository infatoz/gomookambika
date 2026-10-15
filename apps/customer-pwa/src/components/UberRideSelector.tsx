import { Users, Wind, ShieldCheck, Clock, CreditCard, Banknote, Sparkles, ChevronRight, Loader2, Car, Info, Calendar } from 'lucide-react';

export interface VehicleUnitItem {
  registrationNumber: string;
  brand: string;
  vehicleModel: string;
  color?: string;
  fuelType?: string;
  seatCapacity?: number;
  luggageCapacity?: number;
  ac?: boolean;
}

export interface VehicleCategoryItem {
  _id: string;
  name: string;
  code: string;
  seatCapacity: number;
  luggageCapacity?: number;
  ac?: boolean;
  baseFare?: number;
  ratePerKm?: number;
  ratePerHour?: number;
  description?: string;
  image?: string;
  icon?: string;
  vehicleCount?: number;
  popularModels?: string[];
  vehicles?: VehicleUnitItem[];
}

export interface FareEstimateData {
  total: number;
  baseFare: number;
  distanceFare: number;
  distanceKm: number;
  tax?: number;
  nightCharge?: number;
  waitingCharge?: number;
  currency: string;
  isFixedFare: boolean;
  appliedRuleName?: string;
  ratePerKm?: number;
}

interface UberRideSelectorProps {
  categories: VehicleCategoryItem[];
  selectedCategory: VehicleCategoryItem | null;
  onSelectCategory: (category: VehicleCategoryItem) => void;
  fareEstimate: FareEstimateData | null;
  categoryEstimates?: Record<string, FareEstimateData>;
  loadingEstimate: boolean;
  onConfirmRide: () => void;
  bookingLoading: boolean;
  paymentMethod: 'CASH' | 'ONLINE';
  onChangePaymentMethod: (method: 'CASH' | 'ONLINE') => void;
  onOpenVehiclesModal?: () => void;
  isScheduled?: boolean;
  scheduledLabel?: string;
  onOpenScheduleModal?: () => void;
}

// Maps category name or code to the isometric illustration in images/ or admin uploaded image
export function getVehicleImage(cat?: VehicleCategoryItem | null): string {
  if (cat?.image && (cat.image.startsWith('http') || cat.image.startsWith('/') || cat.image.startsWith('data:'))) {
    return cat.image;
  }
  if (cat?.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('/') || cat.icon.startsWith('data:'))) {
    return cat.icon;
  }
  if (!cat) return '/images/SedanComfort.png';
  const norm = `${cat.name} ${cat.code}`.toLowerCase();
  if (norm.includes('hatchback') || norm.includes('mini') || norm.includes('wagonr') || norm.includes('swift')) {
    return '/images/HatchbackMini-AC.png';
  }
  if (norm.includes('suv') || norm.includes('ertiga') || norm.includes('innova') || norm.includes('xl')) {
    return '/images/SuvBlackDriver.png';
  }
  if (norm.includes('auto') || norm.includes('tuktuk') || norm.includes('rickshaw')) {
    return '/images/TuktukGreenYellow.png';
  }
  if (norm.includes('van') || norm.includes('tempo') || norm.includes('traveller') || norm.includes('bus')) {
    return '/images/MinivanLuggage-169-0.png';
  }
  return '/images/SedanComfort.png';
}

export function getEstimatedTime(cat?: VehicleCategoryItem | null): string {
  if (!cat) return '3 min';
  const norm = `${cat.name} ${cat.code}`.toLowerCase();
  if (norm.includes('auto')) return '1 min away';
  if (norm.includes('hatchback')) return '2 min away';
  if (norm.includes('suv')) return '4 min away';
  if (norm.includes('van')) return '7 min away';
  return '3 min away';
}

export function UberRideSelector({
  categories,
  selectedCategory,
  onSelectCategory,
  fareEstimate,
  categoryEstimates,
  loadingEstimate,
  onConfirmRide,
  bookingLoading,
  paymentMethod,
  onChangePaymentMethod,
  onOpenVehiclesModal,
  isScheduled = false,
  scheduledLabel = '',
  onOpenScheduleModal,
}: UberRideSelectorProps) {
  // Show ONLY vehicles active in platform
  const displayCategories: VehicleCategoryItem[] = categories;

  // Helper to compute category specific fare accurately from server estimate
  const getCategoryFare = (cat: VehicleCategoryItem): number => {
    if (categoryEstimates && categoryEstimates[cat._id]?.total) {
      return Math.round(categoryEstimates[cat._id].total);
    }
    if (selectedCategory?._id === cat._id && fareEstimate?.total) {
      return Math.round(fareEstimate.total);
    }
    // Fallback accurate calculation if server estimate not loaded yet
    const dist = fareEstimate?.distanceKm || 25;
    const base = cat.baseFare || 100;
    const rate = cat.ratePerKm || 18;
    const sub = base + dist * rate;
    return Math.round(sub + sub * 0.05);
  };

  const currentEstimate =
    (selectedCategory && categoryEstimates && categoryEstimates[selectedCategory._id]) ||
    fareEstimate;

  return (
    <div className="flex flex-col h-full text-black">
      {/* Ride Options Title */}
      <div className="flex items-center justify-between pb-3 pt-1 border-b border-neutral-100">
        <div>
          <h3 className="font-bold text-lg text-neutral-900 leading-tight">Choose a vehicle type</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {fareEstimate?.distanceKm
              ? `${fareEstimate.distanceKm.toFixed(1)} km • ~${Math.round(fareEstimate.distanceKm * 1.5)} mins`
              : 'Direct from Kollur Temple Taxi Stand'}
          </p>
        </div>
      </div>

      {/* Vehicle Category Cards List */}
      <div className="py-2 space-y-2.5 overflow-y-auto max-h-[320px] md:max-h-[380px] no-scrollbar pr-1">
        {displayCategories.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-200">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-400" />
            <span>Loading active platform vehicle categories...</span>
          </div>
        ) : (
          displayCategories.map(cat => {
            const isSelected = selectedCategory?._id === cat._id;
          const fare = getCategoryFare(cat);
          const imageSrc = getVehicleImage(cat);
          const etaText = getEstimatedTime(cat);

          return (
            <div
              key={cat._id}
              onClick={() => onSelectCategory(cat)}
              className={`flex items-start justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border-2 select-none ${
                isSelected
                  ? 'border-black bg-neutral-50 shadow-md scale-[1.01]'
                  : 'border-transparent bg-white hover:bg-neutral-50/80 border-neutral-100'
              }`}
            >
              {/* Left: Vehicle Thumbnail + Details */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="w-16 h-12 flex items-center justify-center shrink-0 mt-0.5">
                  <img
                    src={imageSrc}
                    alt={cat.name}
                    className="max-h-full max-w-full object-contain filter drop-shadow-sm transition-transform duration-200 hover:scale-105"
                    loading="lazy"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900 truncate">{cat.name}</span>
                    <span className="flex items-center text-[10px] font-semibold text-neutral-600 gap-0.5 bg-neutral-100 px-1.5 py-0.5 rounded-md">
                      <Users className="w-3 h-3 text-neutral-400" />
                      <span>{cat.seatCapacity}</span>
                    </span>
                    {cat.ac && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                        AC
                      </span>
                    )}
                  </div>

                  {/* Available Platform Models */}
                  {cat.popularModels && cat.popularModels.length > 0 ? (
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">
                      {cat.popularModels.join(' • ')}
                    </p>
                  ) : cat.description ? (
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{cat.description}</p>
                  ) : null}

                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1">
                    <span className="text-neutral-700 font-medium">{etaText}</span>
                  </div>
                </div>
              </div>

                {/* Right: Fare Price */}
                <div className="text-right shrink-0 pl-2">
                  <div className="font-black text-base text-neutral-900 font-mono tracking-tight">
                    ₹{fare}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

        {/* Transparent Accurate Fare Breakdown for Selected Vehicle */}
        {currentEstimate && (
          <div className="bg-neutral-50/90 rounded-2xl p-2.5 border border-neutral-200/80 my-1 space-y-1 text-xs">
            <div className="flex items-center justify-between font-semibold text-neutral-800">
              <span className="truncate pr-2">{currentEstimate.appliedRuleName || `${selectedCategory?.name || 'Ride'} Fare`}</span>
              {!currentEstimate.isFixedFare && (
                <span className="text-[11px] font-medium text-neutral-500 shrink-0">
                  ₹{currentEstimate.ratePerKm || selectedCategory?.ratePerKm || 18}/km
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-neutral-500 text-[11px] pt-1 border-t border-neutral-200/60">
              <span>Base Fare</span>
              <span>₹{Math.round(currentEstimate.baseFare)}</span>
            </div>
            {currentEstimate.distanceFare > 0 && (
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Distance Fare ({currentEstimate.distanceKm.toFixed(1)} km)</span>
                <span>₹{Math.round(currentEstimate.distanceFare)}</span>
              </div>
            )}
            {typeof currentEstimate.tax === 'number' && currentEstimate.tax > 0 && (
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>GST & RTO charges (5%)</span>
                <span>₹{Math.round(currentEstimate.tax)}</span>
              </div>
            )}
            {typeof currentEstimate.nightCharge === 'number' && currentEstimate.nightCharge > 0 && (
              <div className="flex items-center justify-between text-amber-700 text-[11px]">
                <span>Night Charges</span>
                <span>₹{Math.round(currentEstimate.nightCharge)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-bold text-neutral-900 text-xs pt-1 border-t border-neutral-200">
              <span>Total Payable</span>
              <span className="font-mono text-sm">₹{Math.round(currentEstimate.total)}</span>
            </div>
          </div>
        )}

        {/* Payment Policy: Cash or UPI settled after ride completion */}
        <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-100/80 font-medium text-neutral-800 border border-neutral-200/80 w-full">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Banknote className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-[11px] text-neutral-900">Pay on Ride Complete</span>
              <span className="text-[10px] text-neutral-500">Only Cash or UPI QR to Captain</span>
            </div>
          </div>
        </div>

        {/* Schedule Trip Mode Selector */}
        <div className="pt-2">
          {isScheduled ? (
            <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-indigo-950 truncate">
                    Pickup: {scheduledLabel || 'Scheduled Trip'}
                  </div>
                  <div className="text-[10px] text-indigo-700 truncate">
                    Assigned to queued driver on trip start date
                  </div>
                </div>
              </div>
              {onOpenScheduleModal && (
                <button
                  type="button"
                  onClick={onOpenScheduleModal}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-100 rounded-lg border border-indigo-300 shrink-0 transition-colors shadow-2xs"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            onOpenScheduleModal && (
              <button
                type="button"
                onClick={onOpenScheduleModal}
                className="w-full py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold border border-neutral-200 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Pickup: <strong>Ride Now (Instant)</strong></span>
                </div>
                <span className="text-[11px] text-indigo-600 font-bold hover:underline">Schedule for later →</span>
              </button>
            )
          )}
        </div>

        {/* Primary Action Button: Confirm or Schedule Ride */}
        <div className="pt-1.5">
          <button
            type="button"
            onClick={onConfirmRide}
            disabled={bookingLoading || loadingEstimate}
            className={`w-full py-4 disabled:bg-neutral-300 text-white font-bold rounded-2xl text-base transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 ${
              isScheduled ? 'bg-indigo-950 hover:bg-indigo-900' : 'bg-black hover:bg-neutral-800'
            }`}
          >
            {bookingLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Confirming your cab...</span>
              </>
            ) : isScheduled ? (
              <>
                <Calendar className="w-5 h-5" />
                <span>Schedule {selectedCategory?.name || 'Ride'}</span>
                <span className="text-sm font-normal opacity-80">
                  • ₹{selectedCategory ? getCategoryFare(selectedCategory) : (currentEstimate?.total || 350)}
                </span>
              </>
            ) : (
              <>
                <span>Choose {selectedCategory?.name || 'Ride'}</span>
                <span className="text-sm font-normal opacity-80">
                  • ₹{selectedCategory ? getCategoryFare(selectedCategory) : (currentEstimate?.total || 350)}
                </span>
              </>
            )}
          </button>
        </div>
    </div>
  );
}
