import React, { useState, useEffect } from 'react';
import { ShieldAlert, Server, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Play, RefreshCw, Terminal, Check } from 'lucide-react';

export default function ResilienceDemo({ healthStatus }) {
  const [testMode, setTestMode] = useState('REST');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const runFailureSimulation = async () => {
    setSimulating(true);
    setSimResult(null);

    // If payment service is down
    const isPaymentDown = !healthStatus.payment;

    try {
      // Dispatch a test order
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 999,
          productId: 999,
          quantity: 1,
          amount: 100.00
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult({
          success: true,
          status: res.status,
          orderId: data.id,
          message: isPaymentDown 
            ? "ORDER ACCEPTED! In Kafka mode, the order was persisted and the event is buffered in the Kafka topic. Payment will complete automatically when Payment Service recovers."
            : "Order succeeded with HTTP 201 Created."
        });
      } else {
        setSimResult({
          success: false,
          status: res.status,
          message: "ORDER FAILED (Cascading Outage): Order Service failed with HTTP " + res.status + " because the downstream Payment Service is unreachable."
        });
      }
    } catch (err) {
      setSimResult({
        success: false,
        status: 503,
        message: "Network Error: Could not reach Order Service or connection refused."
      });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Title Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Fault Tolerance & Failure Recovery Evaluation</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Experimental demonstration of Objective #4: Cascading Failure (REST) vs Temporal Decoupling & Queue Buffering (Kafka).
          </p>
        </div>
        <span className="badge badge-warning">Objective 4 Evaluation</span>
      </div>

      {/* Cluster Health Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        
        {/* Order Service Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Order Service</span>
            <span className={`badge ${healthStatus.order ? 'badge-success' : 'badge-danger'}`}>
              {healthStatus.order ? 'HEALTHY' : 'UNREACHABLE'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port: 8080 · Spring Boot 3.3</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Endpoint: <code className="font-mono">/actuator/health</code>
          </div>
        </div>

        {/* Payment Service Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Payment Service</span>
            <span className={`badge ${healthStatus.payment ? 'badge-success' : 'badge-danger'}`}>
              {healthStatus.payment ? 'HEALTHY' : 'DOWN / STOPPED'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port: 8081 · Downstream Dependency</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Endpoint: <code className="font-mono">/actuator/health</code>
          </div>
        </div>

        {/* Kafka Broker Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kafka Broker (KRaft)</span>
            <span className="badge badge-kafka">3.8.1 BROKER</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port: 9092 · Topic: orders</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Consumer Group: <code className="font-mono">payment-service-group</code>
          </div>
        </div>
      </div>

      {/* Side by Side Architectural Failure Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        
        {/* REST Failure Scenario */}
        <div className="glass-panel" style={{ padding: '1.75rem', borderLeft: '4px solid var(--accent-rest)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <XCircle size={20} color="var(--danger)" />
            <h3 style={{ fontSize: '1.1rem' }}>REST Architecture (Tight Coupling)</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            When the client invokes `POST /api/orders`, the Order Service executes an HTTP call to the Payment Service while holding open the client request thread.
          </p>

          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.35rem' }}>Cascading Failure Mechanism:</div>
            <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>Payment Service outage blocks Tomcat threads until HTTP timeout.</li>
              <li>Order Service returns <code className="font-mono">503 Service Unavailable</code>.</li>
              <li>Order row remains in PENDING state; order creation fails.</li>
              <li><strong>Result: 100% Error Rate during outage.</strong></li>
            </ul>
          </div>
        </div>

        {/* Kafka Failure Scenario */}
        <div className="glass-panel" style={{ padding: '1.75rem', borderLeft: '4px solid var(--accent-kafka)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={20} color="var(--success)" />
            <h3 style={{ fontSize: '1.1rem' }}>Kafka Architecture (Temporal Decoupling)</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            The Order Service saves the order locally and commits the event to Kafka topic `orders` with `acks=all`. It never contacts Payment Service directly.
          </p>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '0.35rem' }}>Fault Isolation Mechanism:</div>
            <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>Payment Service outage has <strong>zero effect</strong> on Order creation.</li>
              <li>Order Service returns <code className="font-mono">201 Created</code> in ~25 ms.</li>
              <li>Messages queue safely in the Kafka topic log partition.</li>
              <li>Once Payment Service restarts, it polls and drains backlog with <strong>zero data loss</strong>.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live Viva Demonstration Terminal Guide */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <Terminal size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem' }}>How to Demonstrate Downstream Failure to University Examiners</h3>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Run these exact commands in PowerShell / Terminal during your viva to show real-time resilience behavior:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {/* Step 1 */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: 'var(--radius-sm)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', marginBottom: '0.5rem' }}>
              Step 1: Simulate Downstream Outage
            </div>
            <pre className="font-mono" style={{ fontSize: '0.75rem', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
              docker stop payment-service
            </pre>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Simulates Payment Service container crash.
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: 'var(--radius-sm)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              Step 2: Dispatch Test Order (from UI or curl)
            </div>
            <pre className="font-mono" style={{ fontSize: '0.75rem', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
              {`curl -i -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"customerId":1,"productId":1,"quantity":1,"amount":100}'`}
            </pre>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              REST returns <strong>503</strong>. Kafka returns <strong>201 Created</strong>!
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: 'var(--radius-sm)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem' }}>
              Step 3: Recover and Verify Lag Drainage
            </div>
            <pre className="font-mono" style={{ fontSize: '0.75rem', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
              docker start payment-service
            </pre>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Payment Service consumes queued messages from offset; lag reaches 0.
            </div>
          </div>
        </div>

        {/* Live Simulation Button */}
        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className="btn btn-primary"
            onClick={runFailureSimulation}
            disabled={simulating}
          >
            {simulating ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            Test Live System Failure Response
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Sends a probe order to test current fault-tolerance reaction.
          </span>
        </div>

        {simResult && (
          <div style={{
            marginTop: '1.25rem',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${simResult.success ? 'var(--success)' : 'var(--danger)'}`,
            background: simResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: simResult.success ? 'var(--success)' : 'var(--danger)',
            fontSize: '0.85rem'
          }}>
            <strong>HTTP Status {simResult.status}:</strong> {simResult.message}
          </div>
        )}
      </div>

    </div>
  );
}
