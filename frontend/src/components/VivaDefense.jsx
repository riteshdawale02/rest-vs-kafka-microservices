import React, { useState } from 'react';
import { GraduationCap, Calculator, HelpCircle, CheckCircle, ChevronDown, ChevronUp, Layers, Check } from 'lucide-react';
import { vivaDefensePoints, theoreticalTradeoffs } from '../data/researchData';

export default function VivaDefense() {
  const [openFaq, setOpenFaq] = useState(0);

  // Little's Law Interactive Calculator
  const [concurrency, setConcurrency] = useState(10); // threads
  const [latencyMs, setLatencyMs] = useState(36.5); // ms

  const latencySec = latencyMs / 1000;
  const theoreticalRps = latencySec > 0 ? (concurrency / latencySec).toFixed(1) : 0;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Title */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Academic Viva & Defense Center</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Comprehensive theoretical defenses, mathematical models, and architectural justification for external university examiners.
          </p>
        </div>
        <span className="badge badge-info">Viva Preparedness</span>
      </div>

      {/* Interactive Little's Law Model */}
      <div className="glass-panel" style={{ padding: '1.75rem', borderLeft: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Calculator size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem' }}>Mathematical Verification: Little's Law ($L = \lambda \cdot W$)</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          In closed-loop load testing (such as JMeter with 10 threads), throughput ($\lambda$) is strictly bounded by Little's Law: 
          <code className="font-mono" style={{ color: 'var(--accent-rest)', marginLeft: '0.4rem' }}>Throughput (RPS) = Concurrency (L) / Latency (W in seconds)</code>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Client Concurrency (Threads / Users: L)</label>
              <input
                type="number"
                className="form-input"
                value={concurrency}
                onChange={e => setConcurrency(Number(e.target.value))}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Average API Latency (ms: W)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={latencyMs}
                onChange={e => setLatencyMs(Number(e.target.value))}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={() => { setConcurrency(10); setLatencyMs(36.5); }}
              >
                Load REST Baseline (36.5ms)
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={() => { setConcurrency(10); setLatencyMs(21.0); }}
              >
                Load Kafka 10p Baseline (21.0ms)
              </button>
            </div>
          </div>

          {/* Calculator Output Card */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-glow)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Predicted Client Throughput ($\lambda$)
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--success)', margin: '0.5rem 0' }}>
              {theoreticalRps} <span style={{ fontSize: '1rem', fontWeight: 500 }}>req/s</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Calculation: {concurrency} threads / {(latencyMs / 1000).toFixed(4)} s = {theoreticalRps} RPS.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-rest)', marginTop: '0.5rem' }}>
              {latencyMs < 30 
                ? "Closely matches measured Kafka 10p throughput (~467 RPS)!" 
                : "Closely matches measured REST throughput (~264-281 RPS)!"}
            </div>
          </div>

        </div>
      </div>

      {/* Core Viva Questions & Model Answers */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <HelpCircle size={20} color="#f59e0b" />
          <h3 style={{ fontSize: '1.1rem' }}>Key Viva Examination Questions & High-Scoring Defenses</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {vivaDefensePoints.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>Q{idx + 1}.</span>
                    {item.question}
                  </span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {isOpen && (
                  <div style={{
                    padding: '0 1.25rem 1.25rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.7',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)'
                  }}>
                    <div style={{ paddingTop: '0.75rem' }}>
                      <strong style={{ color: 'var(--success)' }}>Model Answer: </strong>
                      {item.answer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Architectural Trade-off Matrix */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Architectural Trade-Off Evaluation Matrix</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Comparative decision matrix to defend architectural suitability under different workload scenarios.
        </p>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Evaluation Metric</th>
                <th>REST (HTTP Synchronous)</th>
                <th>Kafka (Event-Driven)</th>
                <th>Better Choice</th>
              </tr>
            </thead>
            <tbody>
              {theoreticalTradeoffs.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{row.metric}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{row.rest}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{row.kafka}</td>
                  <td>
                    <span className={`badge ${row.winner === 'Kafka' ? 'badge-kafka' : 'badge-rest'}`}>
                      {row.winner}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
