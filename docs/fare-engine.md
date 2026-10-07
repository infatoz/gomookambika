# Go Mookambika — Fare Engine Design

## Overview

The fare engine is a server-side only calculation system. Clients NEVER compute fares — they receive fare estimates and final fares from the backend API.

Fare snapshots are stored immutably with each booking. Changing pricing rules after booking creation does NOT affect historical bookings.

---

## Fare Calculation Priority

The engine evaluates rules in this deterministic order:

```
1. Specific Origin + Destination + Vehicle Category (highest priority)
2. Specific Origin + Destination (any vehicle)
3. Vehicle Category specific distance pricing
4. Default distance pricing (lowest priority)
```

First matching rule wins.

---

## Pricing Rule Types

### 1. FIXED (Location-to-Location)

```typescript
// Admin sets a fixed price for a specific route + vehicle
{
  ruleType: "FIXED",
  originLocationId: "mookambika-temple-id",
  destinationLocationId: "udupi-city-id",
  vehicleCategoryId: "sedan-id",
  fixedPrice: 250000  // ₹2500 in paise
}
```

### 2. PER_KM

```typescript
{
  ruleType: "PER_KM",
  vehicleCategoryId: "sedan-id",
  baseFare: 30000,      // ₹300
  minimumKm: 5,
  ratePerKm: 1800,      // ₹18/km
  ratePerHour: 15000    // ₹150/hr (for local/rental)
}
```

Calculation:
```
effectiveKm = max(actualKm, minimumKm)
distanceFare = effectiveKm * ratePerKm
total = baseFare + distanceFare
```

### 3. SLAB

```typescript
{
  ruleType: "SLAB",
  vehicleCategoryId: "suv-id",
  slabs: [
    { fromKm: 0,  toKm: 10,  price: 30000 },
    { fromKm: 11, toKm: 20,  price: 50000 },
    { fromKm: 21, toKm: 40,  price: 90000 },
    { fromKm: 41, toKm: 999, price: 150000 }
  ]
}
```

### 4. LOCATION_TO_LOCATION

Overrides all distance-based calculations for specific routes.

---

## Fare Calculation Steps

```typescript
async function calculateFare(input: FareInput): Promise<FareBreakdown> {
  // 1. Find applicable rule (priority order)
  const rule = await findApplicableRule(input);
  
  // 2. Calculate base fare from rule
  const { baseFare, distanceFare } = await applyRule(rule, input.distanceKm);
  
  // 3. Calculate additional charges
  const additionalCharges = await calculateAdditionalCharges(input, rule);
  
  // 4. Calculate taxes
  const subtotal = baseFare + distanceFare + additionalCharges.total;
  const tax = calculateTax(subtotal, input.tripType);
  
  // 5. Apply discounts (coupons, membership, etc.)
  const discount = await calculateDiscount(input.customerId, subtotal);
  
  // 6. Final total
  const total = subtotal + tax - discount;
  
  return {
    distanceKm: input.distanceKm,
    baseFare,
    distanceFare,
    waitingCharge: additionalCharges.waiting,
    toll: additionalCharges.toll,
    parking: additionalCharges.parking,
    nightCharge: additionalCharges.nightCharge,
    driverAllowance: additionalCharges.driverAllowance,
    serviceFee: additionalCharges.serviceFee,
    discount,
    tax,
    total,
    currency: 'INR',
    ruleId: rule._id,
    calculatedAt: new Date()
  };
}
```

---

## Additional Charges

All configurable in admin panel:

| Charge Type | Calculation Method | Description |
|---|---|---|
| `TOLL` | FIXED per route | Road toll charges |
| `PARKING` | FIXED | Parking fees |
| `WAITING` | PER_MINUTE | Waiting beyond free minutes |
| `NIGHT_CHARGE` | PERCENTAGE | Night surcharge (10PM-6AM) |
| `DRIVER_ALLOWANCE` | FIXED | Driver overnight allowance |
| `EXTRA_KM` | PER_KM | Beyond estimate on round trips |
| `EXTRA_HOUR` | PER_HOUR | Beyond estimate on rental |
| `SERVICE_FEE` | FIXED or PERCENTAGE | Platform service fee |
| `CONVENIENCE_FEE` | FIXED or PERCENTAGE | Online payment fee |
| `GST` | PERCENTAGE | Government tax (5% on taxi) |

---

## Night Charge Detection

```typescript
function isNightCharge(scheduledAt: Date): boolean {
  const hour = scheduledAt.getHours();
  return hour >= 22 || hour < 6;
}
```

---

## Fare Snapshot Immutability

When a booking is confirmed:

```typescript
// Store complete fare snapshot with booking
booking.fareSnapshot = {
  ...fareBreakdown,
  calculatedAt: new Date(),
  ruleId: rule._id,
  ruleName: rule.name,
  ruleType: rule.ruleType
};
await booking.save();

// If pricing changes next day:
// OLD bookings retain their original fareSnapshot
// NEW bookings get new pricing
```

---

## Fare API Endpoints

```
POST /api/v1/fare/estimate
  → Returns fare estimate (not binding)
  
POST /api/v1/fare/calculate
  → Returns binding fare for booking confirmation
  → Stores fare lock in Redis for 10 minutes
  
GET /api/v1/fare/breakdown/:bookingId
  → Returns stored fare snapshot for existing booking
```

---

## Distance Calculation

Distance is fetched from OSRM (routing engine), not calculated as-the-crow-flies:

```typescript
async function getRouteDistance(
  from: Coordinates, 
  to: Coordinates
): Promise<{ distanceKm: number; durationMinutes: number }> {
  const url = `${OSRM_BASE_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`;
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    distanceKm: data.routes[0].distance / 1000,
    durationMinutes: Math.ceil(data.routes[0].duration / 60)
  };
}
```

---

## Fare Rule Conflict Resolution

If multiple rules match (which should not happen in practice due to the priority system):

- Log a warning with rule IDs
- Apply the highest priority (lowest priority number) rule
- Alert admin via notification

---

## Example Fare Calculation

**Trip**: Mookambika Temple → Udupi, Sedan, 72.4 KM

```
Rule Applied: PER_KM for Sedan
Base Fare:       ₹300
Distance Fare:   72.4 × ₹18 = ₹1,303.20
Waiting Charge:  ₹0
Night Charge:    ₹0
Toll:            ₹100
Parking:         ₹0
Service Fee:     ₹50
Subtotal:        ₹1,753.20
GST (5%):        ₹87.66
Discount:        ₹0
─────────────────────────
Total:           ₹1,840.86
```

JSON response:
```json
{
  "distanceKm": 72.4,
  "baseFare": 300,
  "distanceFare": 1303.20,
  "waitingCharge": 0,
  "toll": 100,
  "parking": 0,
  "nightCharge": 0,
  "driverAllowance": 0,
  "serviceFee": 50,
  "discount": 0,
  "tax": 87.66,
  "total": 1840.86,
  "currency": "INR",
  "calculatedAt": "2026-10-07T05:30:00.000Z"
}
```
