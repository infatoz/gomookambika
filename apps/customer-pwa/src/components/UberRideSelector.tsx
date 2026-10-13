import { Users, Wind, ShieldCheck, Clock, CreditCard, Banknote, Sparkles, ChevronRight, Loader2, Car, Info } from 'lucide-react';

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
  loadingEstimate: boolean;
  onConfirmRide: () => void;
  bookingLoading: boolean;
  paymentMethod: 'CASH' | 'ONLINE';
  onChangePaymentMethod: (method: 'CASH' | 'ONLINE') => void;
  onOpenVehiclesModal?: () => void;
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
  loadingEstimate,
  onConfirmRide,
  bookingLoading,
  paymentMethod,
  onChangePaymentMethod,
  onOpenVehiclesModal,
}: UberRideSelectorProps) {
  // If categories are empty, fallback to default display list
  const displayCategories: VehicleCategoryItem[] =
    categories.length > 0
      ? categories
      : [
          {
            _id: '6ac6531652d964d6985b9b04',
            name: 'Sedan',
            code: 'SEDAN',
            seatCapacity: 4,
            ac: true,
            description: 'Dzire, Etios, City • Top-rated drivers',
            baseFare: 100,
            ratePerKm: 18,
            popularModels: ['Maruti Suzuki Dzire Tour', 'Honda City'],
            vehicleCount: 3,
          },
          {
            _id: '6ace272f7f63dda489a559f3',
            name: 'Hatchback Mini',
            code: 'HATCHBACK',
            seatCapacity: 4,
            ac: true,
            description: 'WagonR, Swift • Affordable compact rides',
            baseFare: 80,
            ratePerKm: 15,
            popularModels: ['Maruti Suzuki WagonR', 'Swift'],
            vehicleCount: 2,
          },
          {
            _id: '6acd2d819aca3cc9440ce35c',
            name: 'SUV',
            code: 'SUV',
            seatCapacity: 6,
            ac: true,
            description: 'Innova, Ertiga • Extra room for family',
            baseFare: 150,
            ratePerKm: 24,
            popularModels: ['Toyota Innova Crysta', 'Maruti Ertiga'],
            vehicleCount: 2,
          },
          {
            _id: '6ace272f7f63dda489a55a07',
            name: 'Auto Rickshaw',
            code: 'AUTO',
            seatCapacity: 3,
            ac: false,
            description: 'Quick local temple transport',
            baseFare: 50,
            ratePerKm: 12,
            popularModels: ['Bajaj RE Compact'],
            vehicleCount: 1,
          },
        ];

  // Helper to compute category specific fare
  const getCategoryFare = (cat: VehicleCategoryItem): number => {
    if (fareEstimate) {
      if (selectedCategory?._id === cat._id) {
        return Math.round(fareEstimate.total);
      }
      // Proportional ratio based on per-km rates
      const baseRate = selectedCategory?.ratePerKm || 18;
      const targetRate = cat.ratePerKm || (cat.code === 'SUV' ? 24 : cat.code === 'AUTO' ? 12 : 15);
      const ratio = targetRate / (baseRate || 18);
      return Math.round(fareEstimate.total * ratio);
    }
    // Fallback baseline distance 25km
    const base = cat.baseFare || 100;
    const rate = cat.ratePerKm || 18;
    return Math.round(base + 25 * rate);
  };

  return (
    <div className="flex flex-col h-full text-black">
      {/* Ride Options Title & Fleet Button */}
      <div className="flex items-center justify-between pb-3 pt-1 border-b border-neutral-100">
        <div>
          <h3 className="font-bold text-lg text-neutral-900 leading-tight">Choose a vehicle type</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {fareEstimate?.distanceKm
              ? `${fareEstimate.distanceKm.toFixed(1)} km • ~${Math.round(fareEstimate.distanceKm * 1.5)} mins`
              : 'Direct from Kollur Temple Taxi Stand'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {fareEstimate?.isFixedFare && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              Fixed Tariff
            </span>
          )}

          {onOpenVehiclesModal && (
            <button
              type="button"
              onClick={onOpenVehiclesModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-semibold border border-neutral-200 transition-colors"
              title="View all vehicles created by admin"
            >
              <Car className="w-3 h-3 text-neutral-600" />
              <span>View Fleet</span>
            </button>
          )}
        </div>
      </div>

      {/* Vehicle Category Cards List */}
      <div className="py-2 space-y-2.5 overflow-y-auto max-h-[320px] md:max-h-[380px] no-scrollbar pr-1">
        {displayCategories.map(cat => {
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

                  {/* Available Platform Models created by admin */}
                  {cat.popularModels && cat.popularModels.length > 0 ? (
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">
                      <span className="font-semibold text-neutral-800">Fleet:</span> {cat.popularModels.join(' • ')}
                    </p>
                  ) : cat.description ? (
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{cat.description}</p>
                  ) : null}

                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1">
                    <span className="text-neutral-700 font-medium">{etaText}</span>
                    {typeof cat.vehicleCount === 'number' && cat.vehicleCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                          {cat.vehicleCount} cabs on platform
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Fare Price */}
              <div className="text-right shrink-0 pl-2">
                <div className="font-black text-base text-neutral-900 font-mono tracking-tight">
                  ₹{fare}
                </div>
                {cat.code === 'SEDAN' && (
                  <span className="text-[10px] font-semibold text-emerald-600 block">Popular</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Method Selector & Promo Pill */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={() => onChangePaymentMethod(paymentMethod === 'CASH' ? 'ONLINE' : 'CASH')}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 font-medium text-neutral-800 transition-colors border border-neutral-200/80"
        >
          {paymentMethod === 'CASH' ? (
            <>
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Cash on Drop</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>UPI / Online</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
        </button>

        <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Regulated Tariff</span>
        </div>
      </div>

      {/* Primary Action Button: Confirm Ride */}
      <div className="pt-3">
        <button
          type="button"
          onClick={onConfirmRide}
          disabled={bookingLoading || loadingEstimate}
          className="w-full py-4 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-bold rounded-2xl text-base transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
        >
          {bookingLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Confirming your cab...</span>
            </>
          ) : (
            <>
              <span>Choose {selectedCategory?.name || 'Ride'}</span>
              <span className="text-sm font-normal opacity-80">
                • ₹{selectedCategory ? getCategoryFare(selectedCategory) : fareEstimate?.total || 350}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
