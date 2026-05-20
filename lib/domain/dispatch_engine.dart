import 'package:isar/isar.dart';
import '../data/models/local_schemas.dart';

class DispatchEngine {
  final Isar _isar;
  DispatchEngine(this._isar);

  /// Validates cash liquidity parameters locally before authorizing route generation
  Future<bool> preFlightDriverCheck(String driverPhone) async {
    final driver = await _isar.userProfiles.filter().phoneNumberEqualTo(driverPhone).findFirst();
    if (driver == null) return false;
    
    // Safety check: Lock driver out if accumulated cash platform debt matches invariants
    if (driver.authorizedCashFloat >= 6000.00) {
      await _isar.writeTxn(() async {
        driver.isLockedByDebt = true;
        await _isar.userProfiles.put(driver);
      });
      return false;
    }
    return true;
  }

  /// Processes local cash handover on the device securely without external payment networks
  Future<void> reconcileCashHandover(String tripUuid, double actualCashAmount) async {
    final trip = await _isar.sharedTrips.filter().tripUuidEqualTo(tripUuid).findFirst();
    if (trip == null) return;

    await _isar.writeTxn(() async {
      trip.physicalCashCollected = actualCashAmount;
      trip.currentLifecycleState = "COMPLETED";
      trip.isSyncedWithCloud = false; // Flagged for background sync worker threads
      await _isar.sharedTrips.put(trip);

      // Adjust driver cash float balance parameters matching state inputs
      final driver = await _isar.userProfiles.filter().phoneNumberEqualTo(trip.driverPhone).findFirst();
      if (driver != null) {
        // Platform service fee calculation (e.g., 15% platform commission)
        double platformCommissionFee = trip.finalFareDZD * 0.15;
        driver.authorizedCashFloat += platformCommissionFee;
        
        // If the commission fee pushes the driver's float balance >= 6000, mark lockedByDebt
        if (driver.authorizedCashFloat >= 6000.00) {
          driver.isLockedByDebt = true;
        }
        
        await _isar.userProfiles.put(driver);
      }
    });
  }
}
