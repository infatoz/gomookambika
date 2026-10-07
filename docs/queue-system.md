# Go Mookambika — Queue System Design

## Overview

The queue system is the core domain of Go Mookambika. It manages the physical positioning of drivers at taxi stands and the fair, configurable dispatch of drivers to customer bookings.

---

## Queue Lifecycle

```
Driver Status: OFFLINE
      │
      ├── Enable GPS
      │
      ├── Scan QR code at taxi stand
      │
      ▼
Backend Validation:
  ✓ Driver active?
  ✓ Vehicle active?
  ✓ QR token valid?
  ✓ QR not expired?
  ✓ Driver within GPS radius?
  ✓ Driver not already in active queue?
  ✓ Vehicle category allowed at this stand?
  ✓ Stand operating hours?
  ✓ Queue not at max capacity?
      │
      ▼
Driver Status: IN_QUEUE
Queue Entry: WAITING
Position: N (end of queue)
      │
      ├── Periodic heartbeat (GPS + timestamp)
      │
      ▼
      (wait for booking)
      │
      ▼
Booking dispatched
      │
      ▼
Driver Status: TRIP_OFFERED
Queue Entry: OFFERED
      │
      ├── Driver ACCEPTS within timeout
      │         │
      │         ▼
      │   Driver Status: TRIP_ACCEPTED
      │   Queue Entry: ASSIGNED
      │   Booking: DRIVER_ACCEPTED
      │
      └── Driver DECLINES / TIMEOUT
                │
                ▼
          Apply Decline Policy:
          KEEP_POSITION | MOVE_TO_END |
          TEMPORARY_PAUSE | SUSPEND_AFTER_REPEATED
                │
                ▼
          Offer to next eligible driver
```

---

## QR Security Model

### QR Token Generation

```typescript
interface QRTokenPayload {
  taxiStandId: string;    // stand reference
  tokenId: string;        // unique UUID per QR
  iat: number;            // issued at (unix timestamp)
  exp?: number;           // expiry (if dynamic)
}
```

QR tokens are signed using HMAC-SHA256 with a server-side secret.

The QR code contains only the signed token — no sensitive data.

### Token Validation Steps

1. Decode and verify signature
2. Check tokenId exists in database and is ACTIVE
3. Check token not expired (if dynamic QR enabled)
4. Validate taxiStandId matches expected stand
5. Proceed to GPS validation

### Static vs Dynamic QR

| Mode | Description |
|---|---|
| Static | QR valid until manually rotated. Suitable for physical laminated QR |
| Dynamic | QR expires every N seconds (configurable). Higher security |

Configurable via: `QUEUE_QR_EXPIRY_SECONDS=0` (0 = static)

---

## GPS Validation

Backend performs validation using MongoDB geospatial query:

```typescript
const isWithinRadius = await TaxiStand.aggregate([
  {
    $geoNear: {
      near: { type: 'Point', coordinates: [driverLng, driverLat] },
      distanceField: 'distance',
      maxDistance: stand.queueRadius,
      query: { _id: standId }
    }
  }
]);
```

**Rule**: GPS validation is ALWAYS performed on the backend. Frontend GPS is only used for display purposes and to send coordinates to the API.

---

## Queue Algorithms

### FIFO (Default)

Drivers served in order of joining time within category.

```typescript
const nextDriver = await QueueEntry.findOne({
  taxiStandId,
  vehicleCategoryId: requestedCategory,
  status: QueueEntryStatus.WAITING
}).sort({ position: 1 });
```

### VEHICLE_CATEGORY_FIFO

Same as FIFO but enforces that each category has its own ordered sub-queue.

### NEAREST_ELIGIBLE

Selects the driver whose vehicle is closest to the pickup location (requires real-time GPS).

### MANUAL_ASSIGNMENT

Admin or operator selects the driver manually. Useful for VIP bookings or special cases.

---

## Heartbeat System

While a driver is WAITING in queue:

```
Every QUEUE_HEARTBEAT_SECONDS (default: 30):
  Driver PWA sends:
    { lat, lng, driverId, queueEntryId }
  
  Backend updates:
    queueEntry.lastLocation = { lat, lng }
    queueEntry.lastHeartbeat = now()
    driver.currentLocation = geoPoint
    driver.lastSeen = now()
  
  If driver outside radius:
    - Emit warning to driver
    - Start grace period timer (QUEUE_GRACE_PERIOD_SECONDS)
    - If still outside after grace period:
        → Remove from queue
        → Notify driver
        → Log event
```

### Heartbeat Monitoring Job

A background job runs every 60 seconds checking for stale heartbeats:

```typescript
// Any driver whose lastHeartbeat is older than
// QUEUE_HEARTBEAT_SECONDS * 3 (3 missed heartbeats)
// is considered disconnected and removed from queue
```

---

## Dispatch Engine

```typescript
class DispatchService {
  async dispatchBooking(bookingId: string): Promise<DriverAssignment | null> {
    const booking = await this.bookingRepo.findById(bookingId);
    const policy = await this.settingsService.getQueuePolicy();
    
    const eligibleDrivers = await this.queueService.getEligibleDrivers({
      taxiStandId: booking.originStandId,
      vehicleCategoryId: booking.vehicleCategoryId,
      policy
    });
    
    if (eligibleDrivers.length === 0) return null;
    
    const selected = await this.queuePolicyService.selectDriver(
      eligibleDrivers, 
      booking, 
      policy
    );
    
    await this.offerTrip(selected.driverId, booking);
    
    // Start acceptance timer
    await this.startAcceptanceTimer(selected.driverId, bookingId);
    
    return { driverId: selected.driverId };
  }
}
```

---

## Driver Decline Policies

| Policy | Effect |
|---|---|
| `KEEP_POSITION` | Driver keeps queue position, next driver offered |
| `MOVE_TO_END` | Driver moved to end of queue |
| `TEMPORARY_PAUSE` | Driver paused for N minutes, then restored to end |
| `SUSPEND_AFTER_REPEATED_DECLINE` | After X declines, driver suspended from queue |

All thresholds configurable in admin settings.

---

## Queue States Reference

### Driver Status
| Status | Description |
|---|---|
| `OFFLINE` | Not available |
| `AVAILABLE` | Available but not in queue |
| `IN_QUEUE` | Waiting in a queue |
| `TRIP_OFFERED` | Received a trip offer |
| `TRIP_ACCEPTED` | Accepted a trip |
| `ON_TRIP` | Currently on a trip |
| `PAUSED` | Temporarily paused in queue |
| `SUSPENDED` | Suspended from operations |

### Queue Entry Status
| Status | Description |
|---|---|
| `WAITING` | Actively waiting |
| `OFFERED` | Trip offer pending |
| `ASSIGNED` | Trip accepted and assigned |
| `LEFT` | Driver voluntarily left |
| `REMOVED` | Removed by system/admin |
| `EXPIRED` | Heartbeat timeout |

---

## Destination Queue

After completing a one-way trip:

```
Trip Completed at Destination (e.g., Udupi)
         │
         ▼
If Destination has QR-enabled taxi stand:
  Driver can scan destination QR
         │
         ▼
  GPS + QR validation (same as origin flow)
         │
         ▼
  Driver joins destination queue at end
         │
         ▼
  Next trip from Udupi
```

Admin configures which destination locations allow re-entry into queue.

---

## Queue Analytics Tracked

- `joinedAt` — queue join time
- `position` — queue position at join
- `status changes` — with timestamps
- `tripOfferedAt` — when trip was offered
- `tripAcceptedAt` / `tripDeclinedAt`
- `leftAt` — when left queue
- Derived metrics:
  - **Average wait time** = tripOfferedAt - joinedAt
  - **Acceptance time** = tripAcceptedAt - tripOfferedAt
  - **Queue-to-trip conversion** = ASSIGNED / total entries
  - **Decline rate** = declined / offered
