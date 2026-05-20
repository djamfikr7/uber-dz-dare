import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const initialNodes = [
  { id: 'Rider_Client', label: 'Rider Client', x: 120, y: 120, vx: 0, vy: 0, color: '#00b0ff', desc: 'Rider mobile interface. Submits dispatch requests. Lifecycle states: IDLE -> SEARCHING_OSM -> RIDE_REQUESTED -> EN_ROUTE -> DISPATCH_COMPLETE -> CASH_HANDOVER_PENDING -> TRIP_RESOLVED.' },
  { id: 'Driver_Client', label: 'Driver Client', x: 120, y: 280, vx: 0, vy: 0, color: '#00e676', desc: 'Driver mobile profile. Tracks telemetry intervals (3000ms) and displacement (15m). Lifecycle states: OFFLINE -> ONLINE_IDLE -> JOB_OFFER_PENDING -> INTERCEPTING -> TRANSIT_ACTIVE -> RECONCILING_CASH -> BALANCED.' },
  { id: 'Admin_Console', label: 'Admin Console', x: 380, y: 200, vx: 0, vy: 0, color: '#ffeb3b', desc: 'Web operational dashboard auditing live cash balances, injecting chaos, and monitoring driver debt caps.' },
  { id: 'Mesh_Gateway', label: 'Mesh Gateway', x: 250, y: 200, vx: 0, vy: 0, color: '#e040fb', desc: 'Express and Socket.io gateway server managing active dispatches and enforcing driver debt locks (6000 DZD).' },
  { id: 'Isar_Cache', label: 'Isar Cache', x: 80, y: 350, vx: 0, vy: 0, color: '#ff6e40', desc: 'Local device Isar/SQLite storage layer buffering transactions off-grid when cellular network towers drop out.' },
  { id: 'OSM_Engine', label: 'OSM Engine', x: 250, y: 80, vx: 0, vy: 0, color: '#00e5ff', desc: 'OpenStreetMap routing engine providing routing vectors offline without external network dependency.' }
];

const links = [
  { source: 'Rider_Client', target: 'Mesh_Gateway' },
  { source: 'Driver_Client', target: 'Mesh_Gateway' },
  { source: 'Mesh_Gateway', target: 'Admin_Console' },
  { source: 'Driver_Client', target: 'Isar_Cache' },
  { source: 'Rider_Client', target: 'OSM_Engine' },
  { source: 'Mesh_Gateway', target: 'OSM_Engine' }
];

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({
    activeDriversCount: 0,
    queuedRidesCount: 0,
    activeTripsCount: 0,
    aggregateEscrowDZD: 0,
    drivers: [],
    queuedRides: [],
    activeTrips: [],
    logs: []
  });
  
  // Progress tracker state for 10,000 transaction simulation
  const [simProgress, setSimProgress] = useState({
    progress: 0,
    total: 10000,
    escrow: 0,
    breaches: 0,
    status: 'IDLE' // IDLE, RUNNING, COMPLETED
  });

  // Obsidian-like node states
  const [graphNodes, setGraphNodes] = useState(initialNodes);
  const [selectedNode, setSelectedNode] = useState(initialNodes[3]); // Default to Mesh Gateway

  const terminalEndRef = useRef(null);

  // Set up socket connection to port 4001
  useEffect(() => {
    const socket = io('http://localhost:4001');

    socket.on('connect', () => {
      setIsConnected(true);
      fetchStatus();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('state_update', () => {
      fetchStatus();
    });

    socket.on('system_log_stream', (logEntry) => {
      setMetrics((prev) => ({
        ...prev,
        logs: [...prev.logs, logEntry].slice(-50)
      }));
    });

    // Listen for parallel simulation updates
    socket.on('simulation_progress_broadcast', (progressData) => {
      setSimProgress(progressData);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Force-directed graph physics loop
  useEffect(() => {
    let animationFrameId;

    const updatePhysics = () => {
      setGraphNodes((prevNodes) => {
        const nodes = prevNodes.map(n => ({ ...n, vx: n.vx || 0, vy: n.vy || 0 }));

        // 1. Central force
        const cx = 250, cy = 200;
        nodes.forEach(n => {
          n.vx += (cx - n.x) * 0.003;
          n.vy += (cy - n.y) * 0.003;
        });

        // 2. Repulsion force
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 120) {
              const force = (120 - dist) * 0.04;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              n1.vx -= fx;
              n1.vy -= fy;
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }

        // 3. Spring connection force
        links.forEach(link => {
          const n1 = nodes.find(n => n.id === link.source);
          const n2 = nodes.find(n => n.id === link.target);
          if (n1 && n2) {
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const desiredDist = 130;
            const force = (dist - desiredDist) * 0.015;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            n1.vx += fx;
            n1.vy += fy;
            n2.vx -= fx;
            n2.vy -= fy;
          }
        });

        // Update positions & friction dampening
        return nodes.map(n => {
          let nx = n.x + n.vx;
          let ny = n.y + n.vy;

          // Boundary bounce
          if (nx < 40 || nx > 460) n.vx *= -1;
          if (ny < 40 || ny > 360) n.vy *= -1;

          nx = Math.min(Math.max(nx, 40), 460);
          ny = Math.min(Math.max(ny, 40), 360);

          return {
            ...n,
            x: nx,
            y: ny,
            vx: n.vx * 0.82,
            vy: n.vy * 0.82
          };
        });
      });

      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    updatePhysics();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Fetch status info
  const fetchStatus = () => {
    fetch('http://localhost:4001/api/status')
      .then((res) => res.json())
      .then((data) => {
        setMetrics((prev) => ({
          ...prev,
          activeDriversCount: data.activeDriversCount,
          queuedRidesCount: data.queuedRidesCount,
          activeTripsCount: data.activeTripsCount,
          aggregateEscrowDZD: data.aggregateEscrowDZD,
          drivers: data.drivers,
          queuedRides: data.queuedRides,
          activeTrips: data.activeTrips,
          logs: data.logs && data.logs.length > 0 ? data.logs : prev.logs
        }));
      })
      .catch((err) => console.error('Error fetching state status:', err));
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [metrics.logs]);

  const injectChaos = (scenario) => {
    fetch('http://localhost:4001/api/chaos-inject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ scenario })
    })
      .then((res) => res.json())
      .then(() => fetchStatus())
      .catch((err) => console.error('Error injecting chaos:', err));
  };

  const triggerStressTest = () => {
    fetch('http://localhost:4001/api/run-simulation', {
      method: 'POST'
    })
      .then((res) => res.json())
      .catch((err) => console.error('Error starting stress test:', err));
  };

  // Nudge nodes to demonstrate physics springiness
  const triggerNudge = () => {
    setGraphNodes(prev => prev.map(n => ({
      ...n,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15
    })));
  };

  const mapCoordinatesToSvg = (lat, lng) => {
    const minLat = 36.73;
    const maxLat = 36.78;
    const minLng = 3.03;
    const maxLng = 3.09;

    const width = 500;
    const height = 400;

    const x = ((lng - minLng) / (maxLng - minLng)) * width;
    const y = height - ((lat - minLat) / (maxLat - minLat)) * height;

    return { x: Math.min(Math.max(x, 10), width - 10), y: Math.min(Math.max(y, 10), height - 10) };
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <div className="glass-panel header">
        <div className="header-title">
          <h1>UBER DZ STATE SYSTEM TELEMETRY</h1>
          <p>DISSOCIATED LOCAL-FIRST MESH CONTROL & KNOWLEDGE GRAPH</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={`badge ${isConnected ? 'badge-active' : 'badge-locked'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`pulse-emerald`} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isConnected ? '#00e676' : '#d50000' }}></span>
            {isConnected ? 'LIVE INTERFACE ACTIVE' : 'GATEWAY DISCONNECTED'}
          </span>
          <button id="btn-refresh-status" className="btn-chaos" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={fetchStatus}>
            Refresh
          </button>
        </div>
      </div>

      {/* Parallel Simulation Progress Bar Panel */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
              ⚡ Parallel Validation Simulator (10,000 transactions)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Status: <strong style={{ color: simProgress.status === 'RUNNING' ? 'var(--color-primary)' : simProgress.status === 'COMPLETED' ? '#00e676' : 'var(--text-muted)' }}>{simProgress.status}</strong>
            </span>
          </div>
          {simProgress.status !== 'RUNNING' ? (
            <button id="btn-trigger-stress-test" className="btn-chaos" style={{ padding: '10px 16px', fontSize: '13px', backgroundColor: 'var(--color-primary)', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 0 12px rgba(0, 176, 255, 0.4)' }} onClick={triggerStressTest}>
              🚀 Trigger 10,000 Cycle Parallel Stress Test
            </button>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              PROCESSING...
            </span>
          )}
        </div>

        <div style={{ width: '100%', height: '12px', background: '#070a13', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', marginTop: '4px' }}>
          <div style={{ width: `${(simProgress.progress / simProgress.total) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00b0ff, #00e676)', boxShadow: '0 0 10px #00e676', transition: 'width 0.1s linear' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span>Progress: <strong>{simProgress.progress.toLocaleString()} / {simProgress.total.toLocaleString()} Cycles ({((simProgress.progress / simProgress.total) * 100).toFixed(1)}%)</strong></span>
            <span>Verified Escrow: <strong style={{ color: '#00e676' }}>{simProgress.escrow.toLocaleString()} DZD</strong></span>
            <span>Invariant Limit Lockouts Enforced: <strong style={{ color: 'var(--color-danger)' }}>{simProgress.breaches}</strong></span>
          </div>
          {simProgress.status === 'COMPLETED' && (
            <span style={{ color: '#00e676', fontWeight: 'bold' }}>✓ RULES FULLY VALIDATED</span>
          )}
        </div>
      </div>

      {/* Main Grid Panels */}
      <div className="grid-layout">
        {/* Left Side: Telemetry Maps & Obsidian Graph */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Obsidian-Style Knowledge Graph View */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🕸️ Obsidian Knowledge Graph (System Specification Vault)</span>
              <button className="btn-chaos" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={triggerNudge}>
                Nudge Graph
              </button>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="obsidian-section">
              <div style={{ width: '100%', background: '#040712', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                <svg viewBox="0 0 500 400" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Links / Connections */}
                  {links.map((link, idx) => {
                    const sourceNode = graphNodes.find(n => n.id === link.source);
                    const targetNode = graphNodes.find(n => n.id === link.target);
                    if (!sourceNode || !targetNode) return null;
                    return (
                      <line
                        key={idx}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke="hsla(222, 40%, 35%, 0.4)"
                        strokeWidth="1.5"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {graphNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedNode(node)}
                      >
                        <circle
                          r={isSelected ? 16 : 10}
                          fill={node.color}
                          stroke="#fff"
                          strokeWidth={isSelected ? 2.5 : 0}
                          style={{ filter: `drop-shadow(0 0 6px ${node.color})` }}
                        />
                        <text
                          y="24"
                          fill="var(--text-primary)"
                          fontSize="10"
                          fontWeight={isSelected ? 'bold' : 'normal'}
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                        >
                          {node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Node Info Metadata Inspector */}
              {selectedNode && (
                <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
                  <h3 style={{ color: selectedNode.color, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: selectedNode.color }}></span>
                    {selectedNode.label} Node
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5' }}>
                    {selectedNode.desc}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* OpenStreetMap SVG Engine View */}
          <div className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🗺️ Dynamic OpenStreetMap Telemetry (Algiers Sector)</span>
              <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>OSM ENGINE v1.2</span>
            </h2>
            <div style={{ position: 'relative', width: '100%', background: '#070a13', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <svg viewBox="0 0 500 400" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <path d="M 50,50 Q 150,40 250,60 T 450,50 L 480,250 Q 300,320 200,280 T 30,220 Z" fill="#090f1d" stroke="#1b253b" strokeWidth="2" />
                <path d="M 50,50 Q 150,80 200,180 T 150,300" fill="none" stroke="#161f33" strokeWidth="1" strokeDasharray="4 4" />
                <path d="M 250,60 Q 300,200 200,280" fill="none" stroke="#161f33" strokeWidth="1" strokeDasharray="4 4" />
                
                <text x="70" y="100" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">BAB EL OUED</text>
                <text x="210" y="140" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">CASBAH</text>
                <text x="320" y="110" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">ALGIERS CENTRE</text>
                <text x="130" y="240" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">EL BIAR</text>
                <text x="280" y="260" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">HYDRA</text>
                <text x="250" y="30" fill="var(--color-info)" opacity="0.3" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="3">MEDITERRANEAN SEA</text>

                {metrics.queuedRides.map((ride) => {
                  const pos = mapCoordinatesToSvg(ride.pickupLat, ride.pickupLng);
                  return (
                    <g key={ride.tripUuid}>
                      <circle cx={pos.x} cy={pos.y} r="8" fill="none" stroke="var(--color-warning)" strokeWidth="2" className="pulse-rose">
                        <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={pos.x} cy={pos.y} r="3" fill="var(--color-warning)" />
                      <text x={pos.x + 8} y={pos.y - 4} fill="var(--color-warning)" fontSize="8" fontFamily="var(--font-mono)">RIDER</text>
                    </g>
                  );
                })}

                {metrics.activeTrips.map((trip) => {
                  const start = mapCoordinatesToSvg(trip.pickupLat, trip.pickupLng);
                  const end = mapCoordinatesToSvg(trip.dropoffLat, trip.dropoffLng);
                  return (
                    <g key={trip.tripUuid}>
                      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="var(--color-info)" strokeWidth="1.5" strokeDasharray="5 5">
                        <animate attributeName="stroke-dashoffset" values="30;0" dur="2s" repeatCount="indefinite" />
                      </line>
                      <circle cx={end.x} cy={end.y} r="4" fill="var(--color-danger)" />
                      <text x={end.x + 8} y={end.y} fill="var(--color-danger)" fontSize="8" fontFamily="var(--font-mono)">DEST</text>
                    </g>
                  );
                })}

                {metrics.drivers.map((driver) => {
                  const pos = mapCoordinatesToSvg(driver.coords.lat, driver.coords.lng);
                  const isLocked = driver.cashDebt >= 6000;
                  const color = isLocked ? 'var(--color-danger)' : driver.status === 'TRANSIT_ACTIVE' ? 'var(--color-info)' : 'var(--color-primary)';
                  
                  return (
                    <g key={driver.phone}>
                      <circle cx={pos.x} cy={pos.y} r="6" fill={color} />
                      <circle cx={pos.x} cy={pos.y} r="12" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
                      <text x={pos.x + 10} y={pos.y + 4} fill={color} fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">
                        🚗 {driver.phone.slice(-3)}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(7, 10, 19, 0.85)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                🟢 Idle Driver | 🔵 Active Trip | 🟡 Unassigned Rider | 🔴 Debt Locked
              </div>
            </div>
          </div>

          {/* System Active Drivers Data Matrix */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>🗃️ Active Driver Nodes Registry</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Driver Phone</th>
                    <th>Coordinates</th>
                    <th>Status</th>
                    <th>Cash Float Balance</th>
                    <th>Platform Debt Lock</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.drivers.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No drivers registered on local mesh gateway.</td>
                    </tr>
                  ) : (
                    metrics.drivers.map((driver) => {
                      const isLocked = driver.cashDebt >= 6000.00;
                      return (
                        <tr key={driver.phone}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{driver.phone}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {driver.coords ? `${driver.coords.lat.toFixed(4)}, ${driver.coords.lng.toFixed(4)}` : 'UNKNOWN'}
                          </td>
                          <td>
                            <span className={`badge ${
                              isLocked ? 'badge-locked' : 
                              driver.status === 'TRANSIT_ACTIVE' || driver.status === 'ASSIGNED' ? 'badge-active' : 
                              driver.status === 'OFFLINE' ? 'badge-offline' : 'badge-idle'
                            }`}>
                              {isLocked ? 'DEBT LOCK' : driver.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: isLocked ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                            {driver.cashDebt.toFixed(2)} DZD
                          </td>
                          <td>
                            {isLocked ? (
                              <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                🚫 SUSPENDED (Limit &gt; 6k)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                 COMPLIANT
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Side: Metrics, Chaos, Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Cash Escrow Balance</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                {metrics.aggregateEscrowDZD.toLocaleString()} DZD
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>Off-grid cash collected locally.</div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Unassigned Queue</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: metrics.queuedRidesCount > 0 ? 'var(--color-warning)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                {metrics.queuedRidesCount} Rides
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>Pending driver match vectors.</div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Driver Pools</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                {metrics.drivers.filter(d => d.status !== 'OFFLINE').length} Nodes
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>Drivers online in Algiers sector.</div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Trips</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-info)', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                {metrics.activeTripsCount} Active
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>Passengers currently in-transit.</div>
            </div>
          </div>

          {/* Chaos Injection Command Matrix */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: 'var(--color-danger)' }}>⚡ Administrative Chaos Injector Core</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Inject custom simulated event triggers to test data-reconciliation loop and lockouts.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button id="btn-chaos-cellular" className="btn-chaos" onClick={() => injectChaos('CELLULAR_NETWORK_DROPOUT_MID_ROUTE')}>
                📡 Signal Tower dropout (Bab El Oued Drop)
              </button>
              <button id="btn-chaos-change" className="btn-chaos" onClick={() => injectChaos('DRIVER_INSUFFICIENT_CHANGE_EXCEPTION')}>
                💰 Cash Handover Change Exception (Insufficient Coins)
              </button>
              <button id="btn-chaos-cancellation" className="btn-chaos" onClick={() => injectChaos('RIDER_CANCELLATION_IN_TRANSIT')}>
                ❌ Middle-Transit Rider Cancellation
              </button>
              <button id="btn-chaos-lockout" className="btn-chaos" onClick={() => injectChaos('EXCESSIVE_CASH_DEBT_DISPATCH_LOCKOUT')}>
                🚨 Force Excessive Driver Commission Lockout Check
              </button>
            </div>
          </div>

          {/* Live Telemetry Log Terminal */}
          <div className="glass-panel" style={{ padding: '24px', flexGrow: '1', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💻 Real-time Operational Stream</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>WS LISTENER</span>
            </h2>
            <div style={{ background: '#030509', flexGrow: '1', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px', overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {metrics.logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Listening for incoming node socket stream events...</div>
              ) : (
                metrics.logs.map((log, idx) => {
                  let color = '#fff';
                  if (log.type === 'TRIP_RECONCILED') color = '#00e676';
                  else if (log.type === 'DRIVER_ASSIGNED' || log.type === 'TRIP_QUEUED') color = '#00b0ff';
                  else if (log.type === 'DEBT_LOCKOUT' || log.type === 'LOCKOUT_ENFORCED') color = '#ff1744';
                  else if (log.type === 'CHAOS_INJECTED') color = '#ffeb3b';
                  
                  return (
                    <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      <span style={{ color: 'var(--color-primary)', marginRight: '6px', fontWeight: 'bold' }}>
                        {log.type}
                      </span>
                      <span style={{ color }}>{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
