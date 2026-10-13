import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Send, CheckCircle2, Clock, AlertTriangle, ArrowRight, Zap, Check, Server, Database } from 'lucide-react';

export default function LiveSimulator({ onOrderPlaced }) {
  const [formData, setFormData] = useState({
    customerId: 101,
    productId: 501,
    quantity: 2,
    amount: '1500.00'
  });

  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0); // 0: Idle, 1: Order Saved, 2: Transport (REST/Kafka), 3: Payment Processed, 4: Done
  const [currentResult, setCurrentResult] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeMode, setActiveMode] = useState('DETECTING'); // REST or KAFKA

  // Fetch recent orders and correlate with Payment Service
  const loadRecentOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        // If data is array, take last 10
        const sorted = Array.isArray(data) ? [...data].reverse().slice(0, 10) : [];

        // Fetch payment status for each recent order from Payment Service
        const ordersWithPayments = await Promise.all(
          sorted.map(async (order) => {
            try {
              const payRes = await fetch(`/api/payments/order/${order.id}`);
              if (payRes.ok) {
                const payment = await payRes.json();
                let latencyMs = null;
                if (payment.eventCreatedAt && payment.processedAt) {
                  const tCreate = new Date(payment.eventCreatedAt).getTime();
                  const tProcess = new Date(payment.processedAt).getTime();
                  latencyMs = Math.max(0, tProcess - tCreate);
                }
                return { ...order, payment, paymentStatus: payment.status, latencyMs };
              }
            } catch (err) {}
            return { ...order, payment: null, paymentStatus: 'PROCESSING', latencyMs: null };
          })
        );

        setRecentOrders(ordersWithPayments);
      }
    } catch (e) {
      console.warn("Could not fetch recent orders", e);
    }
  };

  useEffect(() => {
    loadRecentOrders();
    const interval = setInterval(loadRecentOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateOrder = async (burstCount = 1) => {
    setLoading(true);
    setErrorMsg(null);
    setCurrentResult(null);
    setActiveStep(1);

    const startTime = performance.now();

    try {
      // Step 1: Submit to Order Service
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(formData.customerId),
          productId: Number(formData.productId),
          quantity: Number(formData.quantity),
          amount: parseFloat(formData.amount)
        })
      });

      const apiDuration = (performance.now() - startTime).toFixed(1);

      if (!res.ok) {
        throw new Error(`Order failed: HTTP ${res.status} ${res.statusText}`);
      }

      const orderData = await res.json();
      setActiveStep(2);

      // Try fetching the payment immediately to inspect synchronous vs asynchronous timing
      let paymentData = null;
      let e2eMs = null;
      let isAsync = false;

      // Check payment endpoint
      try {
        const payRes = await fetch(`/api/payments/order/${orderData.id}`);
        if (payRes.ok) {
          paymentData = await payRes.json();
          setActiveStep(3);

          if (paymentData.eventCreatedAt && paymentData.processedAt) {
            const tCreate = new Date(paymentData.eventCreatedAt).getTime();
            const tProcess = new Date(paymentData.processedAt).getTime();
            e2eMs = Math.max(0, tProcess - tCreate);
          }
        } else if (payRes.status === 404) {
          // In Kafka mode, payment might be asynchronous and still in flight!
          isAsync = true;
          setActiveStep(2); // Still in flight in Kafka queue
          
          // Poll after 500ms
          setTimeout(async () => {
            try {
              const pollRes = await fetch(`/api/payments/order/${orderData.id}`);
              if (pollRes.ok) {
                const polled = await pollRes.json();
                setActiveStep(4);
                loadRecentOrders();
              }
            } catch (err) {}
          }, 800);
        }
      } catch (err) {
        console.warn("Payment check error:", err);
      }

      const resultPayload = {
        order: orderData,
        payment: paymentData,
        apiDuration,
        e2eMs,
        isAsync,
        timestamp: new Date().toLocaleTimeString()
      };

      setCurrentResult(resultPayload);
      if (!isAsync) setActiveStep(4);
      loadRecentOrders();

    } catch (err) {
      setErrorMsg(err.message);
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Banner / Explanation */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Interactive Request Pipeline Simulator</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Execute live orders against the microservice cluster to observe communication mechanics and latency differentials.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge badge-rest">REST: Sync Blocking</span>
          <span className="badge badge-kafka">Kafka: Asynchronous Broker ACK</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        
        {/* Form Panel */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Send size={18} color="var(--accent-primary)" />
            Order Dispatch Form
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer ID</label>
              <input
                type="number"
                className="form-input"
                value={formData.customerId}
                onChange={e => setFormData({ ...formData, customerId: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Product ID</label>
              <input
                type="number"
                className="form-input"
                value={formData.productId}
                onChange={e => setFormData({ ...formData, productId: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (USD / INR)</label>
              <input
                type="text"
                className="form-input"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => handleCreateOrder(1)}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Submit Order
                </>
              )}
            </button>

            <button
              className="btn btn-secondary"
              onClick={loadRecentOrders}
              title="Refresh database records"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {errorMsg && (
            <div style={{
              marginTop: '1.25rem',
              padding: '0.9rem',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Live Visual Flow Pipeline */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="#f59e0b" />
              Live Architectural Pipeline
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Trace each distributed stage from client dispatch to final database persistence.
            </p>

            {/* Pipeline Stage Visualizer */}
            <div className="pipeline-track">
              <div className="pipeline-connector">
                <div
                  className="pipeline-progress"
                  style={{
                    width: activeStep === 0 ? '0%' : activeStep === 1 ? '33%' : activeStep === 2 ? '66%' : '100%'
                  }}
                />
              </div>

              {/* Node 1 */}
              <div className="pipeline-node">
                <div className={`pipeline-circle ${activeStep >= 1 ? (activeStep > 1 ? 'success' : 'active') : ''}`}>
                  <Database size={20} />
                </div>
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>1. Order Saved</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status: PENDING</span>
              </div>

              {/* Node 2 */}
              <div className="pipeline-node">
                <div className={`pipeline-circle ${activeStep >= 2 ? (activeStep > 2 ? 'success' : 'active') : ''}`}>
                  <Server size={20} />
                </div>
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>2. Transport Dispatch</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HTTP / Kafka Topic</span>
              </div>

              {/* Node 3 */}
              <div className="pipeline-node">
                <div className={`pipeline-circle ${activeStep >= 3 ? 'success' : activeStep === 2 ? 'waiting' : ''}`}>
                  <CheckCircle2 size={20} />
                </div>
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>3. Payment Exec</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status: SUCCESS</span>
              </div>
            </div>
          </div>

          {/* Current Live Metrics Badge */}
          {currentResult ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              border: '1px solid var(--border-subtle)',
              marginTop: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Order #{currentResult.order?.id} Executed at {currentResult.timestamp}
                </span>
                <span className="badge badge-success">HTTP 201 Created</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>API Ack Latency:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-rest)' }}>
                    {currentResult.apiDuration} ms
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>End-to-End Latency:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: currentResult.e2eMs !== null ? 'var(--success)' : 'var(--warning)' }}>
                    {currentResult.e2eMs !== null ? `${currentResult.e2eMs} ms` : 'In Kafka Queue...'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Submit an order above to measure live distributed execution latency.
            </div>
          )}
        </div>
      </div>

      {/* Database Order History */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Persisted Orders (Live Database View)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Showing latest records from MySQL `orderdb.orders`.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={loadRecentOrders}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid var(--border-glow)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#cbd5e1' }}>
          <strong style={{ color: 'var(--accent-rest)' }}>🔬 Academic Design Note: </strong>
          In this research benchmark, the Order Service purposefully does <em>not</em> execute an extra DB UPDATE after payment. This preserves identical database workloads (exactly 1 INSERT) in both REST and Kafka experiments. The payment outcome is independently owned and recorded in the Payment Service database.
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Cust / Prod</th>
                <th>Amount</th>
                <th>Order DB (Order Service)</th>
                <th>Payment DB (Payment Service)</th>
                <th>End-to-End Latency</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length > 0 ? (
                recentOrders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      #{order.id}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      C#{order.customerId} / P#{order.productId}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${order.amount}</td>
                    <td>
                      <span className="badge badge-info">
                        SAVED ({order.status})
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${order.paymentStatus === 'SUCCESS' ? 'badge-success' : order.paymentStatus === 'PROCESSING' ? 'badge-warning' : 'badge-danger'}`}>
                        {order.paymentStatus === 'SUCCESS' ? 'PAID (SUCCESS)' : order.paymentStatus}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: order.latencyMs !== null ? 'var(--success)' : 'var(--text-muted)' }}>
                      {order.latencyMs !== null ? `${order.latencyMs} ms` : '-'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No orders found in database yet. Click "Submit Order" to generate the first record.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
