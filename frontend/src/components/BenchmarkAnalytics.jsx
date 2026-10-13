import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { benchmarkSummary } from '../data/researchData';
import { BarChart3, TrendingUp, Cpu, Database, CheckCircle, Info } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function BenchmarkAnalytics() {
  const [selectedSize, setSelectedSize] = useState('ALL'); // 'ALL', 100, 500, 1000, 5000

  // Filtered dataset
  const filteredData = selectedSize === 'ALL' 
    ? benchmarkSummary 
    : benchmarkSummary.filter(d => d.requests === Number(selectedSize));

  // Chart 1 Data: API Latency vs Request Volume
  const workloads = [100, 500, 1000, 5000];
  const restApiLatencies = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'REST');
    return item ? item.apiAvgMs : null;
  });
  const kafka3pLatencies = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'Kafka (3p / 3t)');
    return item ? item.apiAvgMs : null;
  });
  const kafka10pLatencies = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'Kafka (10p / 10t)');
    return item ? item.apiAvgMs : null;
  });

  const apiLatencyChartData = {
    labels: ['100 Requests', '500 Requests', '1,000 Requests', '5,000 Requests'],
    datasets: [
      {
        label: 'REST (Synchronous)',
        data: restApiLatencies,
        backgroundColor: 'rgba(56, 189, 248, 0.75)',
        borderColor: '#38bdf8',
        borderWidth: 1.5,
        borderRadius: 6
      },
      {
        label: 'Kafka (3 Partitions / 3 Threads)',
        data: kafka3pLatencies,
        backgroundColor: 'rgba(249, 115, 22, 0.75)',
        borderColor: '#f97316',
        borderWidth: 1.5,
        borderRadius: 6
      },
      {
        label: 'Kafka (10 Partitions / 10 Threads)',
        data: [null, null, 28.1, 21.0],
        backgroundColor: 'rgba(168, 85, 247, 0.75)',
        borderColor: '#a855f7',
        borderWidth: 1.5,
        borderRadius: 6
      }
    ]
  };

  // Chart 2 Data: End-to-End Latency (Showing the Consumer Bottleneck)
  const restE2e = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'REST');
    return item ? item.e2eAvgMs : null;
  });
  const kafka3pE2e = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'Kafka (3p / 3t)');
    return item ? item.e2eAvgMs : null;
  });
  const kafka10pE2e = [null, null, 55.8, 52.05];

  const e2eChartData = {
    labels: ['100 Requests', '500 Requests', '1,000 Requests', '5,000 Requests'],
    datasets: [
      {
        label: 'REST End-to-End (ms)',
        data: restE2e,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        tension: 0.3,
        pointRadius: 5,
        borderWidth: 2
      },
      {
        label: 'Kafka 3p/3t End-to-End (ms) - Lag Backlog Bottleneck',
        data: kafka3pE2e,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        tension: 0.3,
        pointRadius: 6,
        borderWidth: 3
      },
      {
        label: 'Kafka 10p/10t End-to-End (ms) - Scaled Parallelism',
        data: kafka10pE2e,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        pointRadius: 5,
        borderWidth: 2
      }
    ]
  };

  // Chart 3: Throughput (RPS)
  const restRps = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'REST');
    return item ? item.throughputRps : null;
  });
  const kafka3pRps = workloads.map(w => {
    const item = benchmarkSummary.find(d => d.requests === w && d.config === 'Kafka (3p / 3t)');
    return item ? item.throughputRps : null;
  });
  const kafka10pRps = [null, null, 352.3, 466.9];

  const throughputChartData = {
    labels: ['100 Requests', '500 Requests', '1,000 Requests', '5,000 Requests'],
    datasets: [
      {
        label: 'REST Client Throughput (RPS)',
        data: restRps,
        backgroundColor: 'rgba(56, 189, 248, 0.75)',
        borderRadius: 6
      },
      {
        label: 'Kafka 3p/3t Throughput (RPS)',
        data: kafka3pRps,
        backgroundColor: 'rgba(249, 115, 22, 0.75)',
        borderRadius: 6
      },
      {
        label: 'Kafka 10p/10t Throughput (RPS)',
        data: kafka10pRps,
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#101623',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Inter' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Analytics Header */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Empirical Benchmark Results & Analysis</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Quantitative evaluation from 10-thread controlled JMeter runs (100, 500, 1000, 5000 requests) with Prometheus/cAdvisor metrics.
          </p>
        </div>
        
        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
          {['ALL', 100, 500, 1000, 5000].map(val => (
            <button
              key={val}
              className={`btn ${selectedSize === String(val) || (val === 'ALL' && selectedSize === 'ALL') ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              onClick={() => setSelectedSize(String(val))}
            >
              {val === 'ALL' ? 'All Workloads' : `${val} Reqs`}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Analytical Insights Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        
        <div className="metric-card accent-kafka">
          <div className="metric-label">Client Throughput Advantage (Little's Law)</div>
          <div className="metric-value">467 <span style={{ fontSize: '1rem', fontWeight: 500 }}>RPS vs 281 RPS</span></div>
          <p className="metric-subtitle">
            Kafka delivers <strong>1.66x higher client throughput</strong> because Order Service unblocks after broker ACK without waiting for payment processing.
          </p>
        </div>

        <div className="metric-card accent-rest">
          <div className="metric-label">End-to-End Latency Leader</div>
          <div className="metric-value">1.75 ms <span style={{ fontSize: '1rem', fontWeight: 500 }}>REST vs 52-5,831 ms</span></div>
          <p className="metric-subtitle">
            REST completes synchronous in-memory network calls in <strong>1.7-4.8 ms</strong>, whereas Kafka incurs broker persistence, polling, and network transport overhead.
          </p>
        </div>

        <div className="metric-card accent-green">
          <div className="metric-label">The Consumer Bottleneck Finding</div>
          <div className="metric-value">5,831 ms ➔ 52 ms</div>
          <p className="metric-subtitle">
            At 5,000 requests, 3 consumer threads fell behind causing huge queue lag (5.8s). Scaling to <strong>10 partitions & 10 threads</strong> eliminated lag down to 52 ms.
          </p>
        </div>

      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
        
        {/* Chart 1: API Latency */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={16} color="var(--accent-rest)" />
            API Acknowledgment Latency (Avg ms)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Lower is better. Measures client round-trip response time (POST /api/orders).
          </p>
          <div style={{ height: '280px' }}>
            <Bar data={apiLatencyChartData} options={chartOptions} />
          </div>
        </div>

        {/* Chart 2: End-to-End Latency */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} color="var(--accent-kafka)" />
            End-to-End Event Processing Latency (Avg ms)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Calculated via `processedAt - eventCreatedAt`. Highlights the 3-thread queue accumulation.
          </p>
          <div style={{ height: '280px' }}>
            <Line data={e2eChartData} options={chartOptions} />
          </div>
        </div>

        {/* Chart 3: Client Throughput */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} color="#10b981" />
            Client Request Throughput (Requests / Second)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Higher is better. Closely matches Little's Law theoretical formula ($L = \lambda W$).
          </p>
          <div style={{ height: '280px' }}>
            <Bar data={throughputChartData} options={chartOptions} />
          </div>
        </div>

        {/* Resource Overhead Note */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} color="#a855f7" />
              Resource Overhead Trade-Off (CPU & Memory)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Academic evaluation must report total system cost, not just speed:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--accent-rest)' }}>REST Resource Cost:</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Order Service: ~450-508 MiB RAM. Payment Service: ~400-419 MiB RAM. Zero broker containers. Clean, lightweight footprint.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--accent-kafka)' }}>Kafka Resource Cost:</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Order & Payment: ~440-525 MiB RAM each. **Kafka Broker container consumes an extra 510 to 1,063 MiB RAM** + background controller CPU cycles.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.6rem 0.9rem', background: 'var(--info-bg)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} />
            <span>Finding: Kafka provides decoupling and throughput at the cost of ~2x overall memory footprint.</span>
          </div>
        </div>

      </div>

      {/* Comprehensive Raw Benchmark Data Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Comprehensive Empirical Research Matrix</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Combined metrics extracted across 3 runs per workload configuration (excluding warmup run 0).
        </p>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Requests</th>
                <th>Configuration</th>
                <th>API Avg Latency</th>
                <th>API p95</th>
                <th>API Throughput</th>
                <th>End-to-End Avg</th>
                <th>E2E p95</th>
                <th>Order Max CPU</th>
                <th>Kafka Max RAM</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{row.requests}</td>
                  <td>
                    <span className={`badge ${row.config.startsWith('REST') ? 'badge-rest' : 'badge-kafka'}`}>
                      {row.config}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.apiAvgMs} ms</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.apiP95Ms} ms</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--success)' }}>
                    {row.throughputRps} rps
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: row.e2eAvgMs > 1000 ? 'var(--danger)' : 'inherit' }}>
                    {row.e2eAvgMs} ms
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.e2eP95Ms} ms</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.orderCpuMaxPct}%</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {row.kafkaMemMiB ? `${row.kafkaMemMiB} MiB` : 'N/A (No broker)'}
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
