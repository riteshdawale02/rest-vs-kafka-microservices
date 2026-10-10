# Research Project Roadmap & Status Tracking

**Research Title:** Comparative Performance Evaluation of REST-Based and Event-Driven Communication in Microservice Architectures  
**Course & Code:** Major Research Project | SEC303 | Semester V – VI (BCA)  
**Technology Stack:** Java 21 · Spring Boot 3.3.5 · Apache Kafka (KRaft) 3.8.1 · MySQL 8.4 · Docker Compose · Prometheus & Grafana · React 19 (Vite)

---

## 1. Project Health & Audit Checklist

| Phase | Milestone | Status | Notes |
|---|---|---|---|
| **Phase 1: Backend Systems** | Order Service & Payment Service built | **100% READY** | Java 21, Spring Boot 3.3.5, MySQL, Docker |
| | Dual Communication Switch (`COMMUNICATION_MODE`) | **100% READY** | Clean switch between `REST` and `KAFKA` |
| | Idempotency (`existsByOrderId` + DB unique key) | **100% READY** | Prevents duplicate payments on message re-delivery |
| | Microsecond Timestamps (`eventCreatedAt` / `processedAt`) | **100% READY** | Accurate End-to-End latency measurement |
| **Phase 2: Observability** | Prometheus, Grafana, cAdvisor stack | **100% READY** | Port 9090 (Prometheus), Port 3000 (Grafana) |
| | Dedicated Dashboard (`rest-vs-kafka.json`) | **100% READY** | Monitors Tomcat threads, Hikari pool, CPU/RAM |
| **Phase 3: Experiments** | 3 Partitions / 3 Threads Baseline (100, 500, 1000, 5000) | **95% READY** | Kafka has 3 runs each. REST 5000 needs runs 2 & 3. |
| | 10 Partitions / 10 Threads Scaled Matrix (1000, 5000) | **100% READY** | Proves consumer parallelism resolves queue lag |
| | Failure & Recovery Test (Payment Service Outage) | ⏳ **PENDING** | Mandatory for Objective #4 |
| **Phase 4: Frontend UI** | React 19 + Vite Interactive Platform | **100% READY** | Live Simulator, Resilience Demo, Analytics, Viva Center |
| **Phase 5: Deliverables** | Academic Research Paper & Thesis | ⏳ **PENDING** | Abstract, Methodology, Findings, Little's Law |
| | Viva Defense Preparation | **100% READY** | Available in React UI and Section 7 below |

---

## 2. Frontend Platform (React + Vite)

The interactive demonstration and analytics dashboard is located at:
```
microservices-research/frontend/
```

### How to Run:
```bash
cd frontend
npm run dev
```
Accessible at: **`http://localhost:5174/`** (or `5173`)

### Modules Implemented:
1. **Live Flow Simulator:** Send live single/burst orders (`POST /api/orders`), trace visual pipeline, measure real API latency and End-to-End processing latency.
2. **Resilience & Fault Tolerance Demo:** Live health status checks of Order Service, Payment Service, and Kafka. Guides and simulates the downstream failure test.
3. **Research Benchmark Analytics:** Interactive Chart.js graphs (API Latency, End-to-End Latency with 3-thread bottleneck, Throughput vs Workload, CPU & Memory usage).
4. **Academic Viva Defense Center:** Interactive Little's Law calculator, collapsible examiner Q&A with model answers, and architectural trade-off evaluation matrix.

---

## 3. What Needs to be Done for 100% Approval

### Step 1: Run Missing Baseline REST 5000 Runs (Runs 2 & 3)
Run PowerShell command:
```powershell
# Ensure monitoring is disabled to keep baseline pure:
Remove-Item Env:COMPOSE_FILE -ErrorAction SilentlyContinue
$env:COMMUNICATION_MODE="REST"
docker compose down -v
docker compose up -d --build

# Run 2 and Run 3:
foreach ($r in 2,3) {
    .\loadtest\run-test.ps1 -Mode REST -Requests 5000 -Run $r -Warmup
}
```

### Step 2: Run the Failure & Recovery Test (Mandatory Objective #4)
Demonstrate and log what happens when `payment-service` goes offline:
```powershell
# 1. Start in REST mode
$env:COMMUNICATION_MODE="REST"
docker compose up -d

# 2. Stop Payment Service
docker stop payment-service

# 3. Attempt order
curl -i -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"customerId":1,"productId":101,"quantity":1,"amount":500}'
# EXPECTED: HTTP 503 Service Unavailable (Proves Cascading Outage)

# 4. Switch to KAFKA mode
docker compose down -v
$env:COMMUNICATION_MODE="KAFKA"
docker compose --profile kafka up -d

# 5. Stop Payment Service
docker stop payment-service

# 6. Attempt order
curl -i -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"customerId":1,"productId":101,"quantity":1,"amount":500}'
# EXPECTED: HTTP 201 Created (Proves Fault Tolerance & Temporal Decoupling)

# 7. Restart Payment Service
docker start payment-service
# EXPECTED: Payment is consumed from topic offset with 0 data loss.
```

---

## 4. Empirical Benchmark Summary Table

| Workload | Configuration | API Avg Latency | API p95 | Client Throughput | End-to-End Latency | E2E Throughput |
|---|---|---|---|---|---|---|
| **100 reqs** | REST | 41.7 ms | 71.3 ms | 223.6 req/s | 4.86 ms | 246.4 pay/s |
| | Kafka 3p/3t | 29.2 ms | 52.0 ms | 301.9 req/s | 158.6 ms | 175.4 pay/s |
| **500 reqs** | REST | 55.6 ms | 137.5 ms | 207.0 req/s | 2.97 ms | 211.3 pay/s |
| | Kafka 3p/3t | 36.5 ms | 93.9 ms | 331.4 req/s | 688.6 ms | 186.9 pay/s |
| **1000 reqs** | REST | 36.5 ms | 82.7 ms | 263.8 req/s | 2.19 ms | 266.3 pay/s |
| | Kafka 3p/3t | 24.0 ms | 32.3 ms | 410.0 req/s | 1,145.1 ms | 227.8 pay/s |
| | **Kafka 10p/10t** | **28.1 ms** | **43.0 ms** | **352.3 req/s** | **55.8 ms** | **351.0 pay/s** |
| **5000 reqs** | REST (Run 1) | 35.1 ms | 58.0 ms | 281.3 req/s | 1.75 ms | 281.9 pay/s |
| | Kafka 3p/3t | 24.9 ms | 34.3 ms | 412.0 req/s | 5,831.1 ms | 241.6 pay/s |
| | **Kafka 10p/10t** | **21.0 ms** | **29.3 ms** | **466.9 req/s** | **52.1 ms** | **467.1 pay/s** |

---

## 5. Key Scientific Findings

1. **Client API Acknowledgment Latency:** Kafka answers the client faster (21–29 ms vs 35–55 ms for REST) because the Order Service only waits for its local DB commit and Kafka broker ACK (`acks=all`), without blocking on payment processing.
2. **Client Throughput (Little's Law Validation):** With 10 client threads ($L=10$), throughput equals $L / W$. At $W \approx 0.036\text{s}$ (REST), theoretical ceiling is $277\text{ req/s}$ (measured: 264–281). At $W \approx 0.021\text{s}$ (Kafka 10p), theoretical ceiling is $476\text{ req/s}$ (measured: 467).
3. **The Consumer Parallelism Bottleneck:** At 5,000 requests, 3 consumer threads could not keep up with 10 producers (producing ~412 req/s while consuming ~240 req/s). This produced a massive queue backlog causing end-to-end latency to rise to 5,831 ms. Scaling to 10 partitions + 10 threads matched consumption to production (~467 pay/s) and dropped end-to-end latency to 52 ms.
4. **Resource Overhead Trade-off:** REST requires zero extra infrastructure. Kafka requires a dedicated broker container consuming an extra 500 to 1,063 MiB RAM and additional controller CPU cycles.

---

## 6. Viva Examination Defense Talking Points

- **Q: Why are API latency and End-to-End latency different measurements?**  
  *Answer:* In REST, API latency equals end-to-end latency because the client waits for the whole flow. In Kafka, API latency measures only local order persistence + broker ACK. End-to-end latency measures true business workflow completion (`processedAt - eventCreatedAt`), which includes message queuing and consumer execution.
- **Q: What blocks in REST vs Kafka producer?**  
  *Answer:* REST blocks Tomcat request threads and DB connection pool waiting for the HTTP response from Payment Service. Kafka producer does not block on payment, but still blocks on broker network acknowledgment because `acks=all` ensures data durability.
- **Q: How is idempotency handled?**  
  *Answer:* Kafka guarantees at-least-once delivery, which can duplicate messages. Payment Service enforces idempotency in two layers: an indexed pre-check (`existsByOrderId`) to skip duplicates cleanly, and a unique DB constraint on `payments.order_id` to prevent race condition duplicates.
- **Q: What are the threats to validity / limitations?**  
  *Answer:* Tests ran on a single physical host sharing CPU cores between JMeter, Docker containers, and the host OS. A distributed multi-node production deployment across distinct networks would introduce additional real-world network latency.

---

## 7. Reproducibility Notes

Keep: all `results*` folders, `docker-compose.yml`, the `loadtest` folder, and the source code. Document fixed parameters (threads, warm-up, `acks=all`, partitions, consumer threads, log level), tool versions, and machine specs.
