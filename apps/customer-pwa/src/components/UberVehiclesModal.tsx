import { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Briefcase, 
  Wind, 
  Fuel, 
  ShieldCheck, 
  CheckCircle2, 
  Car, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { VehicleCategoryItem, getVehicleImage } from './UberRideSelector';

interface VehicleUnit {
  _id: string;
  registrationNumber: string;
  brand: string;
  vehicleModel: string;
  color?: string;
  fuelType?: string;
  manufacturingYear?: number;
  seatCapacity?: number;
  luggageCapacity?: number;
  ac?: boolean;
  driver?: {
    _id?: string;
    name?: string;
    rating?: number;
    totalTrips?: number;
  };
}

export interface VehicleTypeGroup {
  category: VehicleCategoryItem;
  vehicleCount: number;
  vehicles: VehicleUnit[];
}

interface UberVehiclesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: VehicleCategoryItem[];
  onSelectCategory?: (category: VehicleCategoryItem) => void;
}

export function UberVehiclesModal({
  isOpen,
  onClose,
  categories,
  onSelectCategory,
}: UberVehiclesModalProps) {
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>('ALL');
  const [groupedVehicles, setGroupedVehicles] = useState<VehicleTypeGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api
      .get<{ data: VehicleTypeGroup[] }>('/vehicles/by-type')
      .then(res => {
        if (res.data && res.data.length > 0) {
          setGroupedVehicles(res.data);
        } else {
          // Fallback map from categories
          const fallback = categories.map(cat => ({
            category: cat,
            vehicleCount: cat.vehicleCount || (cat.vehicles?.length ?? 1),
            vehicles: (cat.vehicles || []).map((v, i) => ({
              _id: `v_${cat.code}_${i}`,
              registrationNumber: v.registrationNumber,
              brand: v.brand,
              vehicleModel: v.vehicleModel,
              color: v.color,
              fuelType: v.fuelType,
              seatCapacity: v.seatCapacity || cat.seatCapacity,
              ac: v.ac ?? cat.ac,
            })),
          }));
          setGroupedVehicles(fallback);
        }
      })
      .catch(() => {
        // Fallback
        const fallback = categories.map(cat => ({
          category: cat,
          vehicleCount: cat.vehicleCount || 1,
          vehicles: (cat.vehicles || []).map((v, i) => ({
            _id: `v_${cat.code}_${i}`,
            registrationNumber: v.registrationNumber,
            brand: v.brand,
            vehicleModel: v.vehicleModel,
            color: v.color,
            fuelType: v.fuelType,
            seatCapacity: v.seatCapacity || cat.seatCapacity,
            ac: v.ac ?? cat.ac,
          })),
        }));
        setGroupedVehicles(fallback);
      })
      .finally(() => setLoading(false));
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const displayList =
    selectedTypeCode === 'ALL'
      ? groupedVehicles
      : groupedVehicles.filter(g => g.category.code === selectedTypeCode);

  const totalPlatformVehicles = groupedVehicles.reduce(
    (sum, g) => sum + (g.vehicleCount || g.vehicles.length),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden uber-slide-up text-black">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg md:text-xl tracking-tight text-neutral-900">
                Platform Vehicles by Type
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Available vehicles & transparent fares on Go Mookambika
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-6 pt-3 pb-2 border-b border-neutral-100 flex items-center gap-2 overflow-x-auto no-scrollbar bg-neutral-50/60">
          <button
            type="button"
            onClick={() => setSelectedTypeCode('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedTypeCode === 'ALL'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
            }`}
          >
            All Types ({groupedVehicles.length})
          </button>

          {groupedVehicles.map(g => (
            <button
              key={g.category._id}
              type="button"
              onClick={() => setSelectedTypeCode(g.category.code)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                selectedTypeCode === g.category.code
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
              }`}
            >
              {g.category.name} ({g.vehicleCount || g.vehicles.length})
            </button>
          ))}
        </div>

        {/* Vehicles by Type Body List */}
        <div className="p-6 overflow-y-auto space-y-5 no-scrollbar flex-1">
          {loading ? (
            <div className="py-12 text-center text-neutral-400 text-sm">
              Loading platform fleet details...
            </div>
          ) : displayList.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-sm">
              No vehicles found in this category.
            </div>
          ) : (
            displayList.map(group => {
              const cat = group.category;
              const imageSrc = getVehicleImage(cat);

              return (
                <div
                  key={cat._id}
                  className="rounded-2xl border border-neutral-200 bg-white hover:border-neutral-400 transition-all p-4 md:p-5 shadow-xs space-y-4"
                >
                  {/* Top: Image + Category Info + Tariff */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-16 sm:w-28 sm:h-20 bg-neutral-50 rounded-xl p-1.5 flex items-center justify-center shrink-0 border border-neutral-100 shadow-inner">
                        <img
                          src={imageSrc}
                          alt={cat.name}
                          className="max-h-full max-w-full object-contain filter drop-shadow-md"
                          loading="lazy"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-base md:text-lg text-neutral-900 leading-tight">
                            {cat.name}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700">
                            {cat.code}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {cat.description || 'Verified tourist & pilgrimage taxi service'}
                        </p>

                        {/* Specs badges */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                            <Users className="w-3 h-3 text-neutral-500" />
                            <span>{cat.seatCapacity} Seats</span>
                          </span>

                          <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                            <Briefcase className="w-3 h-3 text-neutral-500" />
                            <span>{cat.luggageCapacity || 2} Luggage</span>
                          </span>

                          <span
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              cat.ac
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            <Wind className="w-3 h-3" />
                            <span>{cat.ac ? 'Climate Control AC' : 'Non-AC'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Standard Rates summary */}
                    <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                      <div className="text-[11px] text-neutral-500">Standard Fare</div>
                      <div className="text-sm md:text-base font-black text-neutral-900 font-mono">
                        Base ₹{cat.baseFare} • ₹{cat.ratePerKm}/km
                      </div>
                      {onSelectCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCategory(cat);
                            onClose();
                          }}
                          className="mt-2 w-full sm:w-auto px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <span>Select {cat.name}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Registered Vehicles on Platform created by admin */}
                  <div className="pt-3 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-700 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Registered Vehicles in Fleet ({group.vehicles.length})</span>
                      </span>
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Admin Approved
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.vehicles.map(v => (
                        <div
                          key={v._id || v.registrationNumber}
                          className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-300">
                                {v.registrationNumber}
                              </span>
                              <span className="font-semibold text-xs text-neutral-800 truncate">
                                {v.brand} {v.vehicleModel}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-2 truncate">
                              <span>{v.color || 'White'}</span>
                              <span>•</span>
                              <span>{v.fuelType || 'Petrol'}</span>
                              {v.driver?.name && (
                                <>
                                  <span>•</span>
                                  <span className="text-neutral-700 font-medium truncate">
                                    Captain: {v.driver.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Go Mookambika Taxi Service</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
