# Algeria Enterprise Ride-Sharing System (Uber DZ) Business Rules Specification

This document defines the core business rules, operational constraints, and state transitions for the Algeria local-first ride-sharing platform.

---

## 1. System Metadata & Invariants

```yaml
metadata:
  nodes: [Rider_Client, Driver_Client, Admin_Console, Mesh_Gateway, Isar_Cache, OSM_Engine]
  constraints: [No_Online_Payments, Variable_Cellular_Density, Cash_Float_Debt_Cap]
  currency: DZD
  target_region: Algeria (DZ)
```

### Invariant Rules (Hardcoded)
- **Currency**: `DZD` (Algerian Dinar)
- **Payment Mode**: Strict `CASH_ON_DELIVERY` (COD). Online transactions are not supported.
- **Maximum Driver Debt Limit**: `6000.00 DZD`. Any driver with commission debt equal to or exceeding this threshold is locked from accepting new rides.
- **Platform Commission Fee**: `15%` of the final fare. Added to the driver's cash float debt upon ride reconciliation.
- **Telemetry Frequency**: Minimum of `3000` ms interval for location updates.
- **Geographic Displacement Threshold**: `15.0` meters before updating local cache.

---

## 2. Multi-Role Stateful Lifecycles

### Rider Lifecycle States
1. `IDLE`: Rider has not requested any ride.
2. `SEARCHING_OSM`: Searching for routes on OpenStreetMap.
3. `RIDE_REQUESTED`: Booking is sent to dispatch gateway.
4. `EN_ROUTE`: Rider is in transit.
5. `DISPATCH_COMPLETE`: Destination is reached.
6. `CASH_HANDOVER_PENDING`: Reconciliation of payment.
7. `TRIP_RESOLVED`: Payment is complete; returned to IDLE.

### Driver Lifecycle States
1. `OFFLINE`: Driver is not accepting jobs.
2. `ONLINE_IDLE`: Available to receive offers.
3. `JOB_OFFER_PENDING`: Ride offered but not accepted.
4. `INTERCEPTING`: Navigating to the rider's pickup location.
5. `TRANSIT_ACTIVE`: Actively driving the rider to destination.
6. `RECONCILING_CASH`: Awaiting physical cash payment handover.
7. `BALANCED`: Transaction commission updated; returned to ONLINE_IDLE or OFFLINE.

### Admin System States
1. `MONITOR_TELEMETRY`: Active tracking of ride vectors.
2. `AUDIT_CASH_BALANCES`: Auditing offline/online balances.
3. `INJECT_CHAOS_STATE`: Introducing dropouts or fake ride failures.
4. `ENFORCE_DEBT_LOCKS`: Disabling driver profiles with debt >= 6000 DZD.
5. `MIGRATION_SYNC`: Resolving local SQLite/Isar cache sync with the central DB.
