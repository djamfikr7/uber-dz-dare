const cluster = require('cluster');
const EventEmitter = require('events');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

class SimulationControlUnit extends EventEmitter {
  constructor() {
    super();
    this.usecases = [
      "CELLULAR_NETWORK_DROPOUT_MID_ROUTE",
      "DRIVER_INSUFFICIENT_CHANGE_EXCEPTION",
      "RIDER_CANCELLATION_IN_TRANSIT",
      "EXCESSIVE_CASH_DEBT_DISPATCH_LOCKOUT"
    ];
  }
}

if (cluster.isMaster) {
  console.log(`================================================================`);
  console.log(`🤖 INITIALIZING PARALLEL AGENTIC ARCHITECTURAL SIMULATOR CORE`);
  console.log(`================================================================`);

  const engine = new SimulationControlUnit();
  const workerClusterSize = 4; // Distinct sandboxed worker parallel runtimes

  let simulationReportedFailures = 0;
  let activeWorkers = 0;

  for (let i = 0; i < workerClusterSize; i++) {
    const selectedUseCase = engine.usecases[i % engine.usecases.length];
    cluster.fork({ SCENARIO_TRIGGER: selectedUseCase, RUNTIME_INSTANCE_ID: i });
    activeWorkers++;
  }

  cluster.on('message', (worker, message) => {
    if (message.type === 'STRUCTURAL_INCOHERENCE_IDENTIFIED') {
      simulationReportedFailures++;
      console.log(`\n🚨 [CRITICAL FAULT ENCOUNTERED VIA SIMULATOR]`);
      console.log(`-> Target Location: ${message.details.location}`);
      console.log(`-> Error Context: ${message.details.conflictContext}`);
      console.log(`-> Action Sequence: Deploying Antigravity IDE code generation repair sub-threads...\n`);
      
      // forward to central DARE compiler if needed
      if (process.send) {
        process.send(message);
      }
    } else if (message.type === 'LOG') {
      console.log(`[AGENT CONTEXT LOG][Thread ID: ${worker.process.pid}]: ${message.logPayload}`);
      if (process.send) {
        process.send(message);
      }
    }
  });

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[SYSTEM] Worker ${worker.process.pid} stopped.`);
    activeWorkers--;
    if (activeWorkers === 0) {
      console.log(`[SYSTEM] All simulation workers finished.`);
    }
  });

} else {
  // Parallel Execution Worker Process
  const targetScenario = process.env.SCENARIO_TRIGGER;
  const workerIndex = parseInt(process.env.RUNTIME_INSTANCE_ID);

  class SimulatedAgentWorkspace {
    constructor() {
      this.socket = io('http://localhost:4001');
      this.driverPhone = `+21355500000${workerIndex}`;
      this.riderPhone = `+21366600000${workerIndex}`;
      this.coords = { lat: 36.7538, lng: 3.0588 }; // Algiers central latitude/longitude
      this.cashDebt = workerIndex === 3 ? 6200.00 : 150.00; // Inject high debt to worker 3 to test lockouts
      this.activeTripUuid = null;
      this.isOnline = true;
      
      this.socket.on('connect', () => {
        process.send({
          type: 'LOG',
          logPayload: `Worker ${workerIndex} connected to Socket.io. Initializing driver node: ${this.driverPhone} with cash debt: ${this.cashDebt} DZD.`
        });
        
        // Register this driver on the central gateway
        this.socket.emit('register_driver_node', {
          driverPhone: this.driverPhone,
          coords: this.coords,
          cashDebt: this.cashDebt,
          status: this.cashDebt >= 6000.00 ? "OFFLINE" : "IDLE"
        });
      });

      this.socket.on('job_assignment_broadcast', (ridePayload) => {
        process.send({
          type: 'LOG',
          logPayload: `Driver ${this.driverPhone} received dispatch job: ${ridePayload.tripUuid}`
        });

        // Evaluate the runtime scenario against our business rules to identify data logic conflicts
        if (targetScenario === "EXCESSIVE_CASH_DEBT_DISPATCH_LOCKOUT" || this.cashDebt >= 6000.00) {
          process.send({
            type: 'STRUCTURAL_INCOHERENCE_IDENTIFIED',
            details: {
              location: 'lib/domain/dispatch_engine.dart',
              conflictContext: `Driver profile (${this.driverPhone}) with an excessive cash debt limit of ${this.cashDebt} DZD was assigned an active job payload, breaching SystemInvariants constraint safety metrics.`
            }
          });
          return;
        }

        this.activeTripUuid = ridePayload.tripUuid;
        // Accept the job and update telemetry
        this.socket.emit('update_driver_telemetry', {
          driverPhone: this.driverPhone,
          coords: { lat: ridePayload.pickupLat, lng: ridePayload.pickupLng },
          cashDebt: this.cashDebt,
          status: "TRANSIT_ACTIVE"
        });

        // Simulate travel time and complete trip after 3 seconds
        setTimeout(() => {
          this.reconcileTrip(ridePayload);
        }, 3000);
      });
    }

    reconcileTrip(ridePayload) {
      if (!this.activeTripUuid) return;

      const fare = ridePayload.finalFareDZD;
      const commission = fare * 0.15;
      
      process.send({
        type: 'LOG',
        logPayload: `Reconciling cash handover for Trip ${this.activeTripUuid}. Final Fare: ${fare} DZD. commission fee: ${commission} DZD.`
      });

      if (targetScenario === "DRIVER_INSUFFICIENT_CHANGE_EXCEPTION") {
        process.send({
          type: 'LOG',
          logPayload: `⚠️ [ALERT] Driver ${this.driverPhone} reports insufficient physical change to complete transaction. Flagging transaction resolution.`
        });
      }

      this.cashDebt += commission;
      
      this.socket.emit('trip_reconciled', {
        tripUuid: this.activeTripUuid,
        actualCashCollected: fare,
        platformFee: commission
      });

      this.activeTripUuid = null;
      
      // Update local telemetry after trip complete
      this.socket.emit('update_driver_telemetry', {
        driverPhone: this.driverPhone,
        coords: this.coords,
        cashDebt: this.cashDebt,
        status: this.cashDebt >= 6000.00 ? "OFFLINE" : "IDLE"
      });
    }

    executeAgentLifecycles() {
      // Loop to periodically inject rider requests, update locations, or simulate chaos
      setInterval(() => {
        if (!this.activeTripUuid && this.cashDebt < 6000.00) {
          // Worker 0, 1, 2 inject ride requests periodically
          if (workerIndex !== 3) {
            const tripUuid = uuidv4();
            const pickupLat = this.coords.lat + (Math.random() - 0.5) * 0.01;
            const pickupLng = this.coords.lng + (Math.random() - 0.5) * 0.01;
            
            process.send({
              type: 'LOG',
              logPayload: `Injecting ride request ${tripUuid} near current sector coordinates...`
            });

            this.socket.emit('dispatch_request_injected', {
              tripUuid,
              riderPhone: this.riderPhone,
              pickupLat,
              pickupLng,
              dropoffLat: pickupLat + 0.015,
              dropoffLng: pickupLng + 0.015,
              finalFareDZD: Math.round(350.00 + Math.random() * 400.00)
            });
          }
        }

        // Trigger Scenario Specific actions
        if (targetScenario === "EXCESSIVE_CASH_DEBT_DISPATCH_LOCKOUT" && workerIndex === 3) {
          // Direct check to ensure we catch lockouts
          if (this.cashDebt >= 6000.00) {
            // Check if backend or client has assigned us any job illegally.
            // If the driver is registered with 6200.00 cash debt, they should remain OFFLINE.
            // If they are put in ONLINE_IDLE or ASSIGNED, it is an invariant breach!
            this.socket.emit('dispatch_request_injected', {
              tripUuid: uuidv4(),
              riderPhone: this.riderPhone,
              pickupLat: this.coords.lat,
              pickupLng: this.coords.lng,
              dropoffLat: this.coords.lat + 0.01,
              dropoffLng: this.coords.lng + 0.01,
              finalFareDZD: 500.00
            });
          }
        }

        if (targetScenario === "CELLULAR_NETWORK_DROPOUT_MID_ROUTE") {
          process.send({
            type: 'LOG',
            logPayload: `Simulating cellular towers fade-out inside Bab El Oued zone sector. Buffering updates to local Isar database cache layers.`
          });
        }
      }, 7000 + (workerIndex * 2500));
    }
  }

  const workerRunner = new SimulatedAgentWorkspace();
  workerRunner.executeAgentLifecycles();
}
