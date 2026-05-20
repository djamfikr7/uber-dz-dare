const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let systemActiveDrivers = new Map(); // driverPhone -> driverDetails
let activeTrips = new Map();         // tripUuid -> tripDetails
let unassignedRideQueue = [];
let logs = [];
let aggregateEscrowDZD = 0;

// Log helper to store and broadcast system actions
function systemLog(type, message) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message
  };
  logs.push(logEntry);
  if (logs.length > 100) logs.shift();
  io.emit('system_log_stream', logEntry);
}

// REST API for dashboard metrics
app.get('/api/status', (req, res) => {
  res.json({
    activeDriversCount: systemActiveDrivers.size,
    queuedRidesCount: unassignedRideQueue.length,
    activeTripsCount: activeTrips.size,
    aggregateEscrowDZD,
    drivers: Array.from(systemActiveDrivers.entries()).map(([phone, data]) => ({
      phone,
      status: data.status,
      coords: data.coordinates,
      cashDebt: data.cashDebt
    })),
    queuedRides: unassignedRideQueue,
    activeTrips: Array.from(activeTrips.values()),
    logs: logs.slice(-20)
  });
});

app.post('/api/chaos-inject', (req, res) => {
  const { scenario } = req.body;
  systemLog('CHAOS_INJECTED', `Injected simulation chaos scenario: ${scenario}`);
  io.emit('chaos_broadcast', { scenario });
  res.json({ status: 'success', scenario });
});

io.on('connection', (socket) => {
  systemLog('CONNECTION', `Node connected: ${socket.id}`);

  // Forward simulation progress to all connected consoles
  socket.on('simulation_progress_update', (data) => {
    io.emit('simulation_progress_broadcast', data);
  });

  // Driver registers their offline/online state
  socket.on('register_driver_node', (meta) => {
    systemActiveDrivers.set(meta.driverPhone, {
      socketId: socket.id,
      coordinates: meta.coords,
      cashDebt: meta.cashDebt,
      status: meta.status || "IDLE"
    });
    systemLog('DRIVER_REGISTERED', `Driver ${meta.driverPhone} registered with cash debt ${meta.cashDebt} DZD`);
    io.emit('state_update');
  });

  socket.on('update_driver_telemetry', (meta) => {
    if (systemActiveDrivers.has(meta.driverPhone)) {
      const driver = systemActiveDrivers.get(meta.driverPhone);
      driver.coordinates = meta.coords;
      driver.cashDebt = meta.cashDebt;
      if (meta.status) {
        driver.status = meta.status;
      }
      systemActiveDrivers.set(meta.driverPhone, driver);
      io.emit('state_update');
    }
  });

  // Rider requests a dispatch
  socket.on('dispatch_request_injected', (ridePayload) => {
    systemLog('RIDE_REQUESTED', `Trip ${ridePayload.tripUuid} requested by ${ridePayload.riderPhone}`);

    // Process matching across geospatial coordinates
    let bestDriver = null;
    for (let [phone, driverData] of systemActiveDrivers.entries()) {
      if (driverData.status === "IDLE") {
        if (driverData.cashDebt < 6000) {
          bestDriver = { phone, ...driverData };
          break;
        } else {
          systemLog('LOCKOUT_ENFORCED', `Skipping driver ${phone} due to excessive debt limit (${driverData.cashDebt} DZD)`);
        }
      }
    }

    if (bestDriver) {
      systemActiveDrivers.get(bestDriver.phone).status = "ASSIGNED";
      activeTrips.set(ridePayload.tripUuid, {
        ...ridePayload,
        driverPhone: bestDriver.phone,
        status: "ASSIGNED",
        timestamp: new Date().toISOString()
      });

      io.to(bestDriver.socketId).emit('job_assignment_broadcast', ridePayload);
      socket.emit('match_status_update', { state: "DRIVER_MATCHED", driver: bestDriver.phone });
      systemLog('DRIVER_ASSIGNED', `Trip ${ridePayload.tripUuid} matched with driver ${bestDriver.phone}`);
    } else {
      unassignedRideQueue.push(ridePayload);
      socket.emit('match_status_update', { state: "QUEUED_NO_DRIVERS" });
      systemLog('TRIP_QUEUED', `Trip ${ridePayload.tripUuid} placed in unassigned queue (no eligible drivers)`);
    }
    io.emit('state_update');
  });

  // Reconcile physical cash handover
  socket.on('trip_reconciled', (data) => {
    const { tripUuid, actualCashCollected, platformFee } = data;
    if (activeTrips.has(tripUuid)) {
      const trip = activeTrips.get(tripUuid);
      trip.status = "COMPLETED";
      trip.physicalCashCollected = actualCashCollected;
      
      aggregateEscrowDZD += actualCashCollected;
      
      const driverPhone = trip.driverPhone;
      if (systemActiveDrivers.has(driverPhone)) {
        const driver = systemActiveDrivers.get(driverPhone);
        driver.cashDebt += platformFee;
        driver.status = "IDLE";
        
        if (driver.cashDebt >= 6000.00) {
          driver.status = "OFFLINE";
          systemLog('DEBT_LOCKOUT', `Driver ${driverPhone} auto-suspended locally. Debt: ${driver.cashDebt} DZD`);
        }
      }
      
      activeTrips.delete(tripUuid);
      systemLog('TRIP_RECONCILED', `Trip ${tripUuid} resolved. Cash collected: ${actualCashCollected} DZD. Platform commission fee: ${platformFee} DZD`);
    }
    io.emit('state_update');
  });

  socket.on('disconnect', () => {
    for (let [phone, driverData] of systemActiveDrivers.entries()) {
      if (driverData.socketId === socket.id) {
        systemActiveDrivers.delete(phone);
        systemLog('DRIVER_DISCONNECTED', `Driver ${phone} went offline (socket closed)`);
        break;
      }
    }
    io.emit('state_update');
  });
});

server.listen(4001, () => {
  console.log('Admin Operations Control Center active on port 4001');
});
