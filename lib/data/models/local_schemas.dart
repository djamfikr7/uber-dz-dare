import 'package:isar/isar.dart';

part 'local_schemas.g.dart';

@collection
class UserProfile {
  Id id = Isar.autoIncrement;
  @Index(unique: true, replace: true)
  late String phoneNumber;
  late String secureHash;
  late String roleType; // RIDER, DRIVER, ADMIN
  late double authorizedCashFloat;
  late bool isLockedByDebt;
}

@collection
class SharedTrip {
  Id id = Isar.autoIncrement;
  @Index(unique: true, replace: true)
  late String tripUuid;
  late String riderPhone;
  late String driverPhone;
  
  late double pickupLat;
  late double pickupLng;
  late double dropoffLat;
  late double dropoffLng;
  
  late double finalFareDZD;
  late double physicalCashCollected;
  
  @Index(type: IndexType.hash)
  late String currentLifecycleState; // REQUESTED, ARRIVED, IN_TRANSIT, CASH_PENDING, COMPLETED
  late bool isSyncedWithCloud;
  late DateTime timestamp;
}
