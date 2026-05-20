const cluster = require('cluster');
const EventEmitter = require('events');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

class SimulationControlUnit extends EventEmitter {
  constructor() {
    super();
  }
}

if (cluster.isMaster) {
  console.log(`================================================================`);
  console.log(`🤖 INITIALIZING PARALLEL AGENTIC ARCHITECTURAL SIMULATOR CORE`);
  console.log(`📡 RANDOM SEED SCENARIO SCHEME ACTIVE`);
  console.log(`================================================================`);

  const workerClusterSize = 4;
  let simulationReportedFailures = 0;
  let activeWorkers = 0;

  for (let i = 0; i < workerClusterSize; i++) {
    // Pass instance index and a random seed to each worker process
    const seed = Math.floor(Math.random() * 100000);
    cluster.fork({ RUNTIME_INSTANCE_ID: i, SEED_VALUE: seed });
    activeWorkers++;
  }

  cluster.on('message', (worker, message) => {
    if (message.type === 'STRUCTURAL_INCOHERENCE_IDENTIFIED') {
      simulationReportedFailures++;
      console.log(`\n🚨 [CRITICAL FAULT ENCOUNTERED VIA SIMULATOR]`);
      console.log(`-> Target Location: ${message.details.location}`);
      console.log(`-> Error Context: ${message.details.conflictContext}`);
      console.log(`-> Action Sequence: Deploying DARE code patches...\n`);
    } else if (message.type === 'LOG') {
      console.log(`[AGENT CONTEXT LOG][Thread ID: ${worker.process.pid}]: ${message.logPayload}`);
    }
  });

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[SYSTEM] Worker ${worker.process.pid} stopped.`);
    activeWorkers--;
  });

} else {
  // Parallel Execution Worker Process
  const workerIndex = parseInt(process.env.RUNTIME_INSTANCE_ID);
  const workerSeed = parseInt(process.env.SEED_VALUE);

  // Simple LCG pseudo-random generator to ensure reproducible randomness per worker
  function seededRandom(seed) {
    let currentSeed = seed;
    return function() {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }

  const rollDice = seededRandom(workerSeed + workerIndex);

  class SimulatedAgentWorkspace {
    constructor() {
      this.socket = io('http://localhost:4001');
      this.driverPhone = `+21355500000${workerIndex}`;
      this.riderPhone = `+21366600000${workerIndex}`;
      
      // Seed Algiers central coordinate displacement based on worker index
      const baseLat = 36.7538;
      const baseLng = 3.0588;
      this.coords = { 
        lat: baseLat + (rollDice() - 0.5) * 0.03, 
        lng: baseLng + (rollDice() - 0.5) * 0.03 
      };

      // Driver 3 initializes with high debt to verify locks. Others start low.
      this.cashDebt = workerIndex === 3 ? 6200.00 : 150.00;
      this.activeTripUuid = null;
      
      this.socket.on('connect', () => {
        process.send({
          type: 'LOG',
          logPayload: `Worker ${workerIndex} online. Seed: ${workerSeed}. Driver: ${this.driverPhone} (Debt: ${this.cashDebt} DZD)`
        });
        
        this.socket.emit('register_driver_node', {
          driverPhone: this.driverPhone,
          coords: this.coords,
          cashDebt: this.cashDebt,
          status: this.cashDebt >= 6000.00 ? "OFFLINE" : "IDLE"
        });
      });

      this.socket.on('job_assignment_broadcast', (ridePayload) => {
        // Enforce 6k invariant check
        if (this.cashDebt >= 6000.00) {
          process.send({
            type: 'STRUCTURAL_INCOHERENCE_IDENTIFIED',
            details: {
              location: 'lib/domain/dispatch_engine.dart',
              conflictContext: `Driver profile (${this.driverPhone}) has ${this.cashDebt} DZD, breaching SystemInvariants constraint safety metrics.`
            }
          });
          return;
        }

        this.activeTripUuid = ridePayload.tripUuid;
        
        // Randomly roll a scenario using the seeded random generator
        const roll = rollDice();
        let scenarioName = "NORMAL_DELIVERY";
        if (roll < 0.15) {
          scenarioName = "CELLULAR_NETWORK_DROPOUT_MID_ROUTE";
        } else if (roll < 0.30) {
          scenarioName = "DRIVER_INSUFFICIENT_CHANGE_EXCEPTION";
        } else if (roll < 0.40) {
          scenarioName = "RIDER_CANCELLATION_IN_TRANSIT";
        }

        process.send({
          type: 'LOG',
          logPayload: `Driver ${this.driverPhone} matched. Trip: ${ridePayload.tripUuid}. Seed roll: ${roll.toFixed(3)} -> Event: ${scenarioName}`
        });

        // Set status to active transit
        this.socket.emit('update_driver_telemetry', {
          driverPhone: this.driverPhone,
          coords: { lat: ridePayload.pickupLat, lng: ridePayload.pickupLng },
          cashDebt: this.cashDebt,
          status: "TRANSIT_ACTIVE"
        });

        // Process trip lifecycle based on scenario
        setTimeout(() => {
          this.processTripResolution(ridePayload, scenarioName);
        }, 4000);
      });
    }

    processTripResolution(ridePayload, scenario) {
      if (!this.activeTripUuid) return;

      const fare = ridePayload.finalFareDZD;
      const commission = fare * 0.15;

      if (scenario === "RIDER_CANCELLATION_IN_TRANSIT") {
        process.send({
          type: 'LOG',
          logPayload: `❌ [CANCEL] Rider cancelled Trip ${this.activeTripUuid} middle-transit. Commission waived.`
        });
        
        this.activeTripUuid = null;
        
        // Driver returns to IDLE without debt increment
        this.socket.emit('update_driver_telemetry', {
          driverPhone: this.driverPhone,
          coords: this.coords,
          cashDebt: this.cashDebt,
          status: "IDLE"
        });
        return;
      }

      if (scenario === "CELLULAR_NETWORK_DROPOUT_MID_ROUTE") {
        process.send({
          type: 'LOG',
          logPayload: `📡 [OFF-GRID] Cellular network lost inside Bab El Oued sector. Buffering transaction data locally to Isar Cache.`
        });
      }

      if (scenario === "DRIVER_INSUFFICIENT_CHANGE_EXCEPTION") {
        process.send({
          type: 'LOG',
          logPayload: `⚠️ [CHANGE_ALERT] Driver ${this.driverPhone} reports insufficient physical change to complete transaction.`
        });
      }

      process.send({
        type: 'LOG',
        logPayload: `Reconciled Trip ${this.activeTripUuid}. Fare: ${fare} DZD. commission: ${commission} DZD.`
      });

      this.cashDebt += commission;
      
      this.socket.emit('trip_reconciled', {
        tripUuid: this.activeTripUuid,
        actualCashCollected: fare,
        platformFee: commission
      });

      this.activeTripUuid = null;

      // Update telemetry and suspend driver if debt limit is reached
      const nextStatus = this.cashDebt >= 6000.00 ? "OFFLINE" : "IDLE";
      this.socket.emit('update_driver_telemetry', {
        driverPhone: this.driverPhone,
        coords: this.coords,
        cashDebt: this.cashDebt,
        status: nextStatus
      });
    }

    executeAgentLifecycles() {
      setInterval(() => {
        // Driver 3 remains offline unless debt is reconciled below 6000.00
        if (!this.activeTripUuid && this.cashDebt < 6000.00) {
          if (workerIndex !== 3) {
            const tripUuid = uuidv4();
            const pickupLat = this.coords.lat + (rollDice() - 0.5) * 0.015;
            const pickupLng = this.coords.lng + (rollDice() - 0.5) * 0.015;
            
            process.send({
              type: 'LOG',
              logPayload: `Rider ${this.riderPhone} requesting ride request ${tripUuid.slice(0, 8)}...`
            });

            this.socket.emit('dispatch_request_injected', {
              tripUuid,
              riderPhone: this.riderPhone,
              pickupLat,
              pickupLng,
              dropoffLat: pickupLat + (rollDice() - 0.5) * 0.02,
              dropoffLng: pickupLng + (rollDice() - 0.5) * 0.02,
              finalFareDZD: Math.round(300.00 + rollDice() * 600.00)
            });
          }
        }
      }, 8000 + (workerIndex * 3000));
    }
  }

  const workerRunner = new SimulatedAgentWorkspace();
  workerRunner.executeAgentLifecycles();
}
