import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LiveSimulator from './components/LiveSimulator';
import ResilienceDemo from './components/ResilienceDemo';
import BenchmarkAnalytics from './components/BenchmarkAnalytics';
import VivaDefense from './components/VivaDefense';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator');
  const [healthStatus, setHealthStatus] = useState({
    order: false,
    payment: false,
    kafka: true
  });

  // Check health of microservices
  const checkHealth = async () => {
    try {
      const orderRes = await fetch('/actuator/order/health', { signal: AbortSignal.timeout(2000) });
      const orderOk = orderRes.ok;
      
      let payOk = false;
      try {
        const payRes = await fetch('/actuator/payment/health', { signal: AbortSignal.timeout(2000) });
        payOk = payRes.ok;
      } catch (e) {
        payOk = false;
      }

      setHealthStatus({
        order: orderOk,
        payment: payOk,
        kafka: true
      });
    } catch (err) {
      // If actuator isn't up, check basic endpoints
      try {
        const oCheck = await fetch('/api/orders', { signal: AbortSignal.timeout(1500) });
        setHealthStatus(prev => ({ ...prev, order: oCheck.ok }));
      } catch (e) {
        setHealthStatus(prev => ({ ...prev, order: false }));
      }
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthStatus={healthStatus}
      />

      <main style={{
        flex: 1,
        maxWidth: '1400px',
        width: '100%',
        margin: '2rem auto',
        padding: '0 1.5rem'
      }}>
        {activeTab === 'simulator' && <LiveSimulator />}
        {activeTab === 'resilience' && <ResilienceDemo healthStatus={healthStatus} />}
        {activeTab === 'analytics' && <BenchmarkAnalytics />}
        {activeTab === 'viva' && <VivaDefense />}
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(11, 15, 25, 0.9)',
        padding: '1.5rem 2rem',
        marginTop: '3rem',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <strong>Major Research Project (SEC303)</strong> — Java 21, Spring Boot 3.3.5, Apache Kafka KRaft 3.8.1, MySQL 8.4, Docker Compose.
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Order Service (:8080)</span>
            <span>Payment Service (:8081)</span>
            <span>Prometheus (:9090)</span>
            <span>Grafana (:3000)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
