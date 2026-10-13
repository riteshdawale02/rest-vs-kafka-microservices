import React from 'react';
import { Activity, Cpu, Layers, ShieldAlert, BarChart3, GraduationCap } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, healthStatus }) {
  return (
    <header style={{
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.9rem 2rem'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Project Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}>
            <Layers size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                REST vs Kafka Microservice Benchmark
              </h1>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>BCA SEC303</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Comparative Performance Evaluation & Resilience Demonstration Platform
            </p>
          </div>
        </div>

        {/* Live Service Health Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem'
          }}>
            <span className={`status-dot ${healthStatus.order ? 'status-dot-active' : 'status-dot-down'}`} />
            <span style={{ color: 'var(--text-secondary)' }}>Order Service (:8080)</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem'
          }}>
            <span className={`status-dot ${healthStatus.payment ? 'status-dot-active' : 'status-dot-down'}`} />
            <span style={{ color: 'var(--text-secondary)' }}>Payment Service (:8081)</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ maxWidth: '1400px', margin: '1rem auto 0' }}>
        <div className="tabs-container" style={{ margin: 0 }}>
          <button
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <Activity size={16} />
            Live Flow Simulator
          </button>

          <button
            className={`tab-btn ${activeTab === 'resilience' ? 'active' : ''}`}
            onClick={() => setActiveTab('resilience')}
          >
            <ShieldAlert size={16} />
            Resilience & Fault Injection
          </button>

          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={16} />
            Research Benchmark Analytics
          </button>

          <button
            className={`tab-btn ${activeTab === 'viva' ? 'active' : ''}`}
            onClick={() => setActiveTab('viva')}
          >
            <GraduationCap size={16} />
            Viva & Academic Defense
          </button>
        </div>
      </div>
    </header>
  );
}
