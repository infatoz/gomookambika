import { PricingRule, IPricingRule } from '@/models/PricingRule';
import { AdditionalCharge } from '@/models/PricingRule';
import { VehicleCategory } from '@/models/VehicleCategory';
import { errors } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { FareBreakdown, PriceRuleType, TripType, ChargeType, CalcMethod } from '@gomookambika/types';
import type { Types } from 'mongoose';

export interface FareInput {
  distanceKm: number;
  durationMinutes?: number;
  vehicleCategoryId: string;
  tripType: TripType;
  scheduledAt?: Date;
  pickupLocationId?: string;
  dropLocationId?: string;
  waitingMinutes?: number;
  hasToll?: boolean;
  hasParking?: boolean;
}

export interface FareEstimateResult {
  fareBreakdown: FareBreakdown;
  appliedRuleName: string;
  appliedRuleType: PriceRuleType;
}

export class FareService {
  /**
   * Main fare calculation entry point.
   * Priority:
   *  1. Specific origin + destination + vehicle category  (LOCATION_TO_LOCATION)
   *  2. Specific origin + destination                     (LOCATION_TO_LOCATION, any vehicle)
   *  3. Vehicle-specific distance pricing                 (PER_KM / SLAB)
   *  4. Default vehicle category pricing from category doc
   */
  async calculateFare(input: FareInput): Promise<FareEstimateResult> {
    const { distanceKm, vehicleCategoryId, tripType, scheduledAt, pickupLocationId, dropLocationId } = input;

    // Find the best matching pricing rule
    const rule = await this.findApplicableRule(
      vehicleCategoryId,
      tripType,
      pickupLocationId,
      dropLocationId
    );

    let baseFare = 0;
    let distanceFare = 0;
    let appliedRuleType: PriceRuleType;
    let appliedRuleName: string;
    let waitingChargeRate = 0;
    let nightMultiplier = 1.0;
    let configuredDriverAllowance = 0;

    const category = await VehicleCategory.findById(vehicleCategoryId);

    if (rule) {
      const result = this.applyRule(rule, distanceKm, input.durationMinutes);
      baseFare = result.baseFare;
      distanceFare = result.distanceFare;
      appliedRuleType = rule.ruleType;
      appliedRuleName = rule.name;
      if (category) {
        waitingChargeRate = category.waitingChargePerMin ?? 0;
        nightMultiplier = category.nightChargeMultiplier ?? 1.0;
      }
    } else {
      // Fallback: use vehicle category default rates with multi-tier trip support
      if (!category) throw errors.notFound('Vehicle Category');

      waitingChargeRate = category.waitingChargePerMin ?? 0;
      nightMultiplier = category.nightChargeMultiplier ?? 1.0;

      if (tripType === TripType.ROUND_TRIP && category.fares?.roundTrip) {
        const rt = category.fares.roundTrip;
        baseFare = rt.baseFare ?? 0;
        const minKm = rt.minimumKm ?? category.minimumKm ?? 0;
        const effectiveKm = Math.max(distanceKm, minKm);
        const ratePerKm = rt.ratePerKm ?? category.ratePerKm ?? 0;
        distanceFare = effectiveKm * ratePerKm;
        waitingChargeRate = rt.waitingChargePerMin ?? waitingChargeRate;
        nightMultiplier = rt.nightChargeMultiplier ?? nightMultiplier;
        configuredDriverAllowance = rt.driverAllowance ?? 0;
        appliedRuleType = PriceRuleType.PER_KM;
        appliedRuleName = `${category.name} Round Trip rate`;
      } else if ((tripType === TripType.LOCAL || tripType === TripType.HOURLY_RENTAL) && category.fares?.rental) {
        const rent = category.fares.rental;
        baseFare = rent.baseFare ?? 0;
        const baseKm = rent.baseKm ?? 20;
        const extraKm = Math.max(0, distanceKm - baseKm);
        const extraKmRate = rent.extraKmRate ?? category.extraKmRate ?? category.ratePerKm ?? 0;
        const extraKmCharge = extraKm * extraKmRate;

        const baseHours = rent.baseHours ?? 2;
        const durationHrs = input.durationMinutes ? input.durationMinutes / 60 : 0;
        const extraHours = Math.max(0, Math.ceil(durationHrs - baseHours));
        const extraHourRate = rent.extraHourRate ?? category.extraHourRate ?? 0;
        const extraHoursCharge = extraHours * extraHourRate;

        distanceFare = extraKmCharge + extraHoursCharge;
        waitingChargeRate = rent.waitingChargePerMin ?? waitingChargeRate;
        nightMultiplier = rent.nightChargeMultiplier ?? nightMultiplier;
        appliedRuleType = PriceRuleType.FIXED;
        appliedRuleName = `${category.name} Local Rental (${baseHours}h/${baseKm}km)`;
      } else if (category.fares?.oneWay) {
        const ow = category.fares.oneWay;
        baseFare = ow.baseFare ?? 0;
        const minKm = ow.minimumKm ?? category.minimumKm ?? 0;
        const effectiveKm = Math.max(distanceKm, minKm);
        const ratePerKm = ow.ratePerKm ?? category.ratePerKm ?? 0;
        distanceFare = effectiveKm * ratePerKm;
        waitingChargeRate = ow.waitingChargePerMin ?? waitingChargeRate;
        nightMultiplier = ow.nightChargeMultiplier ?? nightMultiplier;
        appliedRuleType = PriceRuleType.PER_KM;
        appliedRuleName = `${category.name} One Way rate`;
      } else {
        baseFare = category.baseFare ?? 0;
        const effectiveKm = Math.max(distanceKm, category.minimumKm ?? 0);
        distanceFare = effectiveKm * (category.ratePerKm ?? 0);
        appliedRuleType = PriceRuleType.PER_KM;
        appliedRuleName = `${category.name} default rate`;
      }
    }

    // Calculate additional charges
    const additionalCharges = await this.calculateAdditionalCharges(input, vehicleCategoryId);

    // Apply category waiting rate if waiting minutes provided and not overridden by special rule
    if (input.waitingMinutes && input.waitingMinutes > 0 && additionalCharges.waiting === 0 && waitingChargeRate > 0) {
      additionalCharges.waiting = Math.round(input.waitingMinutes * waitingChargeRate * 100) / 100;
    }

    // Apply configured driver allowance for round trips if not already added by special rule
    if (configuredDriverAllowance > 0 && additionalCharges.driverAllowance === 0) {
      additionalCharges.driverAllowance = configuredDriverAllowance;
    }

    // Night charge based on vehicle category multiplier
    const nightCharge = this.calculateNightCharge(
      baseFare + distanceFare,
      scheduledAt,
      nightMultiplier
    );

    // Subtotal before tax
    const subtotal =
      baseFare +
      distanceFare +
      additionalCharges.waiting +
      additionalCharges.toll +
      additionalCharges.parking +
      additionalCharges.driverAllowance +
      additionalCharges.serviceFee +
      nightCharge;

    // Tax (GST 5% on ride fare, not configurable per law)
    const taxRate = await this.getTaxRate(tripType);
    const tax = Math.round(subtotal * taxRate * 100) / 100;

    const total = Math.round((subtotal + tax) * 100) / 100;

    const fareBreakdown: FareBreakdown = {
      distanceKm: Math.round(distanceKm * 100) / 100,
      baseFare: Math.round(baseFare * 100) / 100,
      distanceFare: Math.round(distanceFare * 100) / 100,
      waitingCharge: Math.round(additionalCharges.waiting * 100) / 100,
      toll: Math.round(additionalCharges.toll * 100) / 100,
      parking: Math.round(additionalCharges.parking * 100) / 100,
      nightCharge: Math.round(nightCharge * 100) / 100,
      driverAllowance: Math.round(additionalCharges.driverAllowance * 100) / 100,
      serviceFee: Math.round(additionalCharges.serviceFee * 100) / 100,
      discount: 0,
      tax: Math.round(tax * 100) / 100,
      total,
      currency: 'INR',
      calculatedAt: new Date(),
    };

    return {
      fareBreakdown,
      appliedRuleName,
      appliedRuleType,
    };
  }

  // ─── RULE FINDER (Priority Order) ──────────────────────────

  private async findApplicableRule(
    vehicleCategoryId: string,
    tripType: TripType,
    pickupLocationId?: string,
    dropLocationId?: string
  ): Promise<IPricingRule | null> {
    const now = new Date();

    const baseQuery = {
      status: 'ACTIVE',
      $or: [
        { validFrom: { $exists: false } },
        { validFrom: null },
        { validFrom: { $lte: now } },
      ],
      $and: [
        {
          $or: [
            { validTo: { $exists: false } },
            { validTo: null },
            { validTo: { $gte: now } },
          ],
        },
      ],
    };

    // Priority 1: Specific origin + destination + vehicle
    if (pickupLocationId && dropLocationId) {
      const rule = await PricingRule.findOne({
        ...baseQuery,
        originLocationId: pickupLocationId,
        destinationLocationId: dropLocationId,
        vehicleCategoryId,
        ruleType: { $in: [PriceRuleType.FIXED, PriceRuleType.LOCATION_TO_LOCATION] },
      }).sort({ priority: 1 });

      if (rule) return rule;

      // Priority 2: Specific origin + destination (any vehicle)
      const rule2 = await PricingRule.findOne({
        ...baseQuery,
        originLocationId: pickupLocationId,
        destinationLocationId: dropLocationId,
        vehicleCategoryId: { $exists: false },
        ruleType: { $in: [PriceRuleType.FIXED, PriceRuleType.LOCATION_TO_LOCATION] },
      }).sort({ priority: 1 });

      if (rule2) return rule2;
    }

    // Priority 3: Vehicle-specific distance pricing
    const rule3 = await PricingRule.findOne({
      ...baseQuery,
      vehicleCategoryId,
      ruleType: { $in: [PriceRuleType.PER_KM, PriceRuleType.SLAB] },
      $or: [{ tripType: tripType }, { tripType: { $exists: false } }, { tripType: null }],
    }).sort({ priority: 1 });

    return rule3;
    // Priority 4 (default): vehicle category base rate — handled in calculateFare as fallback
  }

  // ─── RULE APPLICATOR ────────────────────────────────────────

  private applyRule(
    rule: IPricingRule,
    distanceKm: number,
    durationMinutes?: number
  ): { baseFare: number; distanceFare: number } {
    switch (rule.ruleType) {
      case PriceRuleType.FIXED:
      case PriceRuleType.LOCATION_TO_LOCATION:
        return { baseFare: rule.fixedPrice ?? 0, distanceFare: 0 };

      case PriceRuleType.PER_KM: {
        const baseFare = rule.baseFare ?? 0;
        const effectiveKm = Math.max(distanceKm, rule.minimumKm ?? 0);
        const distanceFare = effectiveKm * (rule.ratePerKm ?? 0);
        return { baseFare, distanceFare };
      }

      case PriceRuleType.SLAB: {
        if (!rule.slabs || rule.slabs.length === 0) {
          return { baseFare: 0, distanceFare: 0 };
        }
        // Find matching slab
        const slab = rule.slabs.find(
          s => distanceKm >= s.fromKm && distanceKm <= s.toKm
        );
        // Use last slab if distance exceeds all ranges
        const appliedSlab = slab ?? rule.slabs[rule.slabs.length - 1];
        return { baseFare: appliedSlab?.price ?? 0, distanceFare: 0 };
      }

      default:
        logger.warn(`Unknown rule type: ${rule.ruleType}`);
        return { baseFare: 0, distanceFare: 0 };
    }
  }

  // ─── ADDITIONAL CHARGES ──────────────────────────────────────

  private async calculateAdditionalCharges(
    input: FareInput,
    vehicleCategoryId: string
  ): Promise<{
    waiting: number;
    toll: number;
    parking: number;
    driverAllowance: number;
    serviceFee: number;
  }> {
    const charges = await AdditionalCharge.find({
      status: 'ACTIVE',
      $or: [
        { applicableTripTypes: { $size: 0 } },
        { applicableTripTypes: input.tripType },
      ],
    });

    const result = { waiting: 0, toll: 0, parking: 0, driverAllowance: 0, serviceFee: 0 };

    for (const charge of charges) {
      // Check vehicle category restriction
      if (
        charge.applicableVehicleCategories.length > 0 &&
        !charge.applicableVehicleCategories.some(id => id.toString() === vehicleCategoryId)
      ) {
        continue;
      }

      let amount = 0;

      switch (charge.calculationMethod) {
        case CalcMethod.FIXED:
          amount = charge.value;
          break;
        case CalcMethod.PER_MINUTE:
          if (input.waitingMinutes && input.waitingMinutes > (charge.freeMinutes ?? 0)) {
            amount =
              (input.waitingMinutes - (charge.freeMinutes ?? 0)) * charge.value;
          }
          break;
        default:
          break;
      }

      switch (charge.chargeType) {
        case ChargeType.WAITING:
          result.waiting += amount;
          break;
        case ChargeType.TOLL:
          result.toll += input.hasToll ? amount : 0;
          break;
        case ChargeType.PARKING:
          result.parking += input.hasParking ? amount : 0;
          break;
        case ChargeType.DRIVER_ALLOWANCE:
          result.driverAllowance += amount;
          break;
        case ChargeType.SERVICE_FEE:
        case ChargeType.CONVENIENCE_FEE:
          result.serviceFee += amount;
          break;
      }
    }

    return result;
  }

  private calculateNightCharge(
    subtotal: number,
    scheduledAt?: Date,
    nightMultiplier: number = 1.0
  ): number {
    if (!scheduledAt) return 0;
    const hour = scheduledAt.getHours();
    const isNight = hour >= 22 || hour < 6;
    if (!isNight) return 0;
    // Surcharge percentage: e.g. multiplier 1.25 yields 25% surcharge
    const surchargeRate = nightMultiplier > 1 ? nightMultiplier - 1.0 : 0.1;
    return Math.round(subtotal * surchargeRate * 100) / 100;
  }

  private async getTaxRate(_tripType: TripType): Promise<number> {
    const gstCharge = await AdditionalCharge.findOne({ chargeType: ChargeType.GST, status: 'ACTIVE' });
    if (gstCharge && gstCharge.calculationMethod === CalcMethod.PERCENTAGE) {
      return gstCharge.value / 100;
    }
    return 0.05; // Default 5% GST on taxi services
  }
}

export const fareService = new FareService();
