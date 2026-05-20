import 'package:flutter/material.dart';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'data/models/local_schemas.dart';
import 'domain/dispatch_engine.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Isar database locally
  final dir = await getApplicationDocumentsDirectory();
  final isar = await Isar.open(
    [UserProfileSchema, SharedTripSchema],
    directory: dir.path,
  );

  runApp(MyApp(isar: isar));
}

class MyApp extends StatelessWidget {
  final Isar isar;
  const MyApp({super.key, required this.isar});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Uber DZ Core',
      theme: ThemeData.dark().copyWith(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.teal,
          brightness: Brightness.dark,
        ),
      ),
      home: DashboardHome(isar: isar),
    );
  }
}

class DashboardHome extends StatefulWidget {
  final Isar isar;
  const DashboardHome({super.key, required this.isar});

  @override
  State<DashboardHome> createState() => _DashboardHomeState();
}

class _DashboardHomeState extends State<DashboardHome> {
  late DispatchEngine _dispatchEngine;
  String _statusMessage = "System initialized and ready.";

  @override
  void initState() {
    super.initState();
    _dispatchEngine = DispatchEngine(widget.isar);
  }

  Future<void> _seedDemoData() async {
    await widget.isar.writeTxn(() async {
      await widget.isar.userProfiles.clear();
      await widget.isar.sharedTrips.clear();

      final rider = UserProfile()
        ..phoneNumber = "+213666000001"
        ..secureHash = "hash_rider_1"
        ..roleType = "RIDER"
        ..authorizedCashFloat = 0.0
        ..isLockedByDebt = false;

      final driver = UserProfile()
        ..phoneNumber = "+213555000001"
        ..secureHash = "hash_driver_1"
        ..roleType = "DRIVER"
        ..authorizedCashFloat = 1500.0
        ..isLockedByDebt = false;

      await widget.isar.userProfiles.putAll([rider, driver]);
    });

    setState(() {
      _statusMessage = "Demo profiles seeded locally.";
    });
  }

  Future<void> _testPreflight() async {
    final success = await _dispatchEngine.preFlightDriverCheck("+213555000001");
    setState(() {
      _statusMessage = success 
          ? "Preflight passed. Driver is authorized to accept rides." 
          : "Preflight failed! Driver locked or doesn't exist.";
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Uber DZ Core Engine'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _seedDemoData,
            tooltip: "Seed Demo Data",
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              color: Colors.teal.withOpacity(0.15),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text(
                      'ALGERIA OPERATIONS CORE',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _statusMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontFamily: 'monospace'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _testPreflight,
              child: const Text('Verify Driver Preflight Lockout'),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: () async {
                // Seed a trip and reconcile cash physical handover
                final tripUuid = "trip-test-uuid-123";
                await widget.isar.writeTxn(() async {
                  final trip = SharedTrip()
                    ..tripUuid = tripUuid
                    ..riderPhone = "+213666000001"
                    ..driverPhone = "+213555000001"
                    ..pickupLat = 36.7538
                    ..pickupLng = 3.0588
                    ..dropoffLat = 36.7650
                    ..dropoffLng = 3.0700
                    ..finalFareDZD = 500.00
                    ..physicalCashCollected = 0.0
                    ..currentLifecycleState = "CASH_PENDING"
                    ..isSyncedWithCloud = false
                    ..timestamp = DateTime.now();
                  await widget.isar.sharedTrips.put(trip);
                });

                await _dispatchEngine.reconcileCashHandover(tripUuid, 500.00);

                final updatedDriver = await widget.isar.userProfiles
                    .filter()
                    .phoneNumberEqualTo("+213555000001")
                    .findFirst();

                setState(() {
                  _statusMessage = "Cash Handover Reconciled.\n"
                      "Commission: 75.00 DZD added to driver float.\n"
                      "Updated Driver float: ${updatedDriver?.authorizedCashFloat} DZD.";
                });
              },
              child: const Text('Reconcile Mock Cash Handover (500 DZD)'),
            ),
          ],
        ),
      ),
    );
  }
}
