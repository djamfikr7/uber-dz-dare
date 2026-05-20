const { parentPort, workerData } = require('worker_threads');

const { limit, threadId, startDebt } = workerData;
const maxDebtLimit = 6000.00;

console.log(`[Worker-${threadId}] Spawned. Running ${limit} transactions. Initial debt: ${startDebt} DZD.`);

let executed = 0;
let platformEscrow = 0;
let violationsPrevented = 0;
let currentDebt = startDebt;

// Execute transactions in chunks to yield thread control and report progress smoothly
const chunkSize = 250; 
function runChunk() {
  const nextTarget = Math.min(executed + chunkSize, limit);
  let chunkEscrow = 0;
  let chunkViolations = 0;
  
  for (let i = executed; i < nextTarget; i++) {
    const fare = Math.round(300 + Math.random() * 500);
    const platformCommission = fare * 0.15;

    // Check invariants
    if (currentDebt >= maxDebtLimit) {
      chunkViolations++;
      // Auto-reconciliation logic: reset/clear driver debt
      currentDebt = 0.00;
    } else {
      currentDebt += platformCommission;
      chunkEscrow += fare;
    }
  }

  const chunkExecutedCount = nextTarget - executed;
  executed = nextTarget;
  platformEscrow += chunkEscrow;
  violationsPrevented += chunkViolations;

  // Report progress back to the parent thread
  parentPort.postMessage({
    type: 'PROGRESS',
    threadId,
    count: chunkExecutedCount,
    escrow: chunkEscrow,
    violations: chunkViolations
  });

  if (executed < limit) {
    // Schedule next chunk
    setTimeout(runChunk, 15);
  } else {
    // Completed
    parentPort.postMessage({
      type: 'DONE',
      threadId,
      totalExecuted: executed,
      totalEscrow: platformEscrow,
      totalViolations: violationsPrevented
    });
  }
}

// Start processing
runChunk();
