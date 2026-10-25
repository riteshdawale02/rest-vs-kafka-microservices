# Complete Operations Guide: Running, Testing, and Benchmarking

**Project Title:** Comparative Performance Evaluation of REST-Based and Event-Driven Communication in Microservice Architectures  
**Course Code:** BCA Major Research Project | SEC303  
**Components:** Java 21 · Spring Boot 3.3.5 · Apache Kafka 3.8.1 (KRaft) · MySQL 8.4 · Docker · JMeter 5.6.3 · Prometheus & Grafana · React 19 Frontend

This runbook provides complete, copy-paste instructions for starting the entire platform, running tests, executing benchmark matrices, observing metrics, and demonstrating resilience to examiners.

---

## 1. System Architecture & Port Map

Before starting, ensure no other services are using these host ports:

| Service / Container | Host Port | Internal Port | Description & Health Check |
|---|---|---|---|
| **Order Service** | `8080` | `8080` | REST API entry point · [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) |
| **Payment Service** | `8081` | `8081` | Payment processing service · [http://localhost:8081/actuator/health](http://localhost:8081/actuator/health) |
| **React Dashboard** | `5174` (or `5173`) | `5174` | Interactive UI Platform · [http://localhost:5174](http://localhost:5174) |
| **Order MySQL** | `3308` | `3306` | MySQL database for `orderdb` (`orders` table) |
| **Payment MySQL** | `3307` | `3306` | MySQL database for `paymentdb` (`payments` table) |
| **Kafka Broker** | `9092` | `9092` | Apache Kafka broker (KRaft single-node) |
| **Prometheus** | `9090` | `9090` | Time-series metrics engine · [http://localhost:9090](http://localhost:9090) |
| **Grafana** | `3000` | `3000` | Observability dashboards · [http://localhost:3000](http://localhost:3000) (admin/admin) |
| **cAdvisor** | `8085` | `8080` | Docker container CPU/Memory monitor |

---

## 2. Prerequisites Check

Open PowerShell as Administrator or regular terminal in the project directory:
```powershell
cd "d:\temp\Research project\microservices-research\microservices-research"
```

Verify your installed toolchain:
```powershell
# 1. Check Java (must be Java 21)
java -version

# 2. Check Docker & Compose (Compose v2.20.2+)
docker --version
docker compose version

# 3. Check Node & npm (Node v20+ recommended)
node -v
npm -v

# 4. Check JMeter (for automated load testing)
jmeter -version
```

---

## 3. Running the React Frontend Platform

The modern interactive frontend lets you trigger live orders, test failure injection, and explore benchmark graphs.

```powershell
# Open a new terminal:
cd "d:\temp\Research project\microservices-research\microservices-research\frontend"

# 1. Install dependencies (if not already done)
npm install

# 2. Start the Vite dev server
npm run dev
```

Open your browser to:
👉 **`http://localhost:5174/`** *(or `http://localhost:5173/`)*

### What you will see:
1. **Live Flow Simulator:** Submit orders, watch the animated 3-stage pipeline, and view live API latency and End-to-End latency.
2. **Resilience & Faults:** Test what happens when Payment Service is stopped (REST 503 vs Kafka 201).
3. **Research Analytics:** Interactive charts for API Latency, End-to-End Latency, Throughput (RPS), and CPU/RAM usage.
4. **Viva Defense:** Interactive Little's Law calculator ($Throughput = L / W$) and examiner Q&A.

---

## 4. Running Mode A: REST (Synchronous HTTP)

In REST mode, the Order Service saves an order and blocks on a synchronous HTTP call to Payment Service (`http://payment-service:8081/api/payments`).

### Step 1: Start the REST Cluster
```powershell
cd "d:\temp\Research project\microservices-research\microservices-research"

# Reset environment variables
Remove-Item Env:COMPOSE_FILE -ErrorAction SilentlyContinue
$env:COMMUNICATION_MODE = "REST"

# Wipe existing containers/volumes and start cleanly
docker compose down -v
docker compose up -d --build
```

### Step 2: Verify All Containers are Healthy
```powershell
docker compose ps
```
You should see 4 active containers:
- `order-mysql` (healthy)
- `payment-mysql` (healthy)
- `order-service` (running on port 8080)
- `payment-service` (running on port 8081)
*(Note: Kafka is NOT started in REST mode, saving CPU and RAM)*

### Step 3: Test with a Sample Order
```powershell
# Send a test order
curl.exe -i -X POST http://localhost:8080/api/orders `
  -H "Content-Type: application/json" `
  -d '{"customerId":101,"productId":501,"quantity":2,"amount":1500.00}'

# Verify order in Order Service
curl.exe http://localhost:8080/api/orders/1

# Verify payment in Payment Service (should be present immediately)
curl.exe http://localhost:8081/api/payments/order/1
```

---

## 5. Running Mode B: Kafka (Asynchronous Event-Driven)

In Kafka mode, the Order Service saves an order, commits an `OrderCreatedEvent` to Kafka topic `orders` with `acks=all`, and returns `201 Created` immediately. The Payment Service consumes the event asynchronously.

### Step 1: Start the Kafka Cluster
```powershell
cd "d:\temp\Research project\microservices-research\microservices-research"

# Stop REST stack and wipe volumes
docker compose down -v

# Start with KAFKA mode and the "kafka" profile
$env:COMMUNICATION_MODE = "KAFKA"
docker compose --profile kafka up -d --build
```

### Step 2: Verify Kafka Health & Topic Creation
```powershell
# Check container status
docker compose ps
# Ensure 'kafka' is (healthy) and 'kafka-init' exited with code 0

# Check that the topic 'orders' exists
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# Describe the topic (verify 3 partitions)
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

### Step 3: Test Order & Observe Event Flow
```powershell
# Send an order
curl.exe -i -X POST http://localhost:8080/api/orders `
  -H "Content-Type: application/json" `
  -d '{"customerId":101,"productId":501,"quantity":2,"amount":1500.00}'

# Notice: Returns 201 Created in ~20-25 ms!
# Verify payment in Payment Service (processed asynchronously)
curl.exe http://localhost:8081/api/payments/order/1
```

### Step 4: Check Kafka Offsets and Consumer Lag
```powershell
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh `
  --bootstrap-server localhost:9092 `
  --describe --group payment-service-group
```
`LAG = 0` means all published events have been consumed.

---

## 6. Running with Full Monitoring (Prometheus + Grafana + cAdvisor)

To observe JVM heap, Tomcat busy threads, Hikari connection pool, and container metrics:

```powershell
# Enable the monitoring compose file overlay
$env:COMPOSE_FILE = "docker-compose.yml;docker-compose.monitoring.yml"

# For REST with monitoring:
$env:COMMUNICATION_MODE = "REST"
docker compose up -d

# OR for Kafka with monitoring:
$env:COMMUNICATION_MODE = "KAFKA"
docker compose --profile kafka up -d
```

### Accessing Dashboards:
1. **Prometheus Targets:** Open [http://localhost:9090/targets](http://localhost:9090/targets) (verify `order-service` and `payment-service` are **UP**).
2. **Grafana Dashboard:** Open [http://localhost:3000](http://localhost:3000)
   - Username: `admin` | Password: `admin`
   - Navigate to Dashboards ➔ **`REST vs Kafka Benchmark`**
3. **cAdvisor:** Open [http://localhost:8085](http://localhost:8085) for container metrics.

---

## 7. Running Controlled Automated Load Tests (JMeter)

The script `loadtest/run-test.ps1` runs headless JMeter, warms up the JVM, truncates MySQL tables, samples CPU/memory every 2 seconds, and records metrics to `results\summary.csv`.

### Example 1: Run REST Benchmark (1,000 Requests, Run 1)
```powershell
# Stack must be running in REST mode
.\loadtest\run-test.ps1 -Mode REST -Requests 1000 -Run 1 -Warmup
```

### Example 2: Run Kafka 3-Partition Benchmark (1,000 Requests, Run 1)
```powershell
# Stack must be running in KAFKA mode
.\loadtest\run-test.ps1 -Mode KAFKA -Requests 1000 -Run 1 -Warmup
```

### Example 3: Run Missing Baseline REST 5,000 Runs (Runs 2 and 3)
```powershell
# 1. Start pure baseline REST stack without monitoring
Remove-Item Env:COMPOSE_FILE -ErrorAction SilentlyContinue
$env:COMMUNICATION_MODE = "REST"
docker compose down -v
docker compose up -d --build

# 2. Execute Run 2 and Run 3
foreach ($r in 2, 3) {
    .\loadtest\run-test.ps1 -Mode REST -Requests 5000 -Run $r -Warmup
}
```

---

## 8. Failure & Recovery Experiment (Examiner Viva Demo)

This experiment fulfills **Objective #4** of your research abstract: demonstrating resilience under downstream outage.

### Part 1: Failure in REST Mode (Cascading Outage)
```powershell
# 1. Start REST stack
$env:COMMUNICATION_MODE = "REST"
docker compose up -d

# 2. Stop the Payment Service (simulating crash)
docker stop payment-service

# 3. Attempt to place an order
curl.exe -i -X POST http://localhost:8080/api/orders `
  -H "Content-Type: application/json" `
  -d '{"customerId":999,"productId":999,"quantity":1,"amount":100}'

# OBSERVATION:
# HTTP 503 Service Unavailable is returned after timeout.
# The order cannot proceed; cascading failure breaks the client.
```

### Part 2: Resilience in Kafka Mode (Temporal Decoupling)
```powershell
# 1. Start Kafka stack
docker compose down -v
$env:COMMUNICATION_MODE = "KAFKA"
docker compose --profile kafka up -d

# 2. Stop the Payment Service
docker stop payment-service

# 3. Attempt to place an order
curl.exe -i -X POST http://localhost:8080/api/orders `
  -H "Content-Type: application/json" `
  -d '{"customerId":999,"productId":999,"quantity":1,"amount":100}'

# OBSERVATION:
# HTTP 201 Created is returned in ~25 ms!
# The order is saved; the message sits safely buffered in Kafka topic 'orders'.

# 4. Check Kafka Consumer Lag (will show LAG = 1)
docker exec kafka /opt/kafka/bin/kafka-consumer-groups.sh `
  --bootstrap-server localhost:9092 `
  --describe --group payment-service-group

# 5. Restart the Payment Service
docker start payment-service

# 6. Verify lag drains to 0 and payment is processed:
Start-Sleep -Seconds 3
curl.exe http://localhost:8081/api/payments/order/1
# OBSERVATION: Payment SUCCESS with zero data loss!
```

---

## 9. Inspecting the MySQL Databases

Both databases use `root` / `root`.

### Check Orders in `order-mysql`:
```powershell
docker exec -it order-mysql mysql -uroot -proot orderdb -e "SELECT id, customer_id, product_id, status, created_at FROM orders ORDER BY id DESC LIMIT 5;"
```

### Check Payments & Calculate Real Latency in `payment-mysql`:
```powershell
docker exec -it payment-mysql mysql -uroot -proot paymentdb -e "SELECT id, order_id, amount, status, event_created_at, processed_at, TIMESTAMPDIFF(MICROSECOND, event_created_at, processed_at)/1000 AS latency_ms FROM payments ORDER BY id DESC LIMIT 5;"
```

### Compute Average & Max Latency across all processed rows:
```sql
SELECT 
  COUNT(*) AS total_payments,
  AVG(TIMESTAMPDIFF(MICROSECOND, event_created_at, processed_at))/1000 AS avg_e2e_ms,
  MAX(TIMESTAMPDIFF(MICROSECOND, event_created_at, processed_at))/1000 AS max_e2e_ms
FROM payments 
WHERE event_created_at IS NOT NULL;
```

---

## 10. Running Unit & Integration Tests Locally

Both services have automated test suites using in-memory H2 and MockMvc (no MySQL or Kafka needed during build):

```powershell
# Test Order Service
cd "d:\temp\Research project\microservices-research\microservices-research\order-service"
mvn clean test

# Test Payment Service
cd "d:\temp\Research project\microservices-research\microservices-research\payment-service"
mvn clean test
```

---

## 11. Teardown & Reset Commands

Whenever switching experiments or clearing data:

```powershell
cd "d:\temp\Research project\microservices-research\microservices-research"

# Stop all containers and remove volumes (clears MySQL & Kafka logs):
docker compose --profile kafka down -v

# Reset any compose overrides in your PowerShell session:
Remove-Item Env:COMPOSE_FILE -ErrorAction SilentlyContinue
Remove-Item Env:COMMUNICATION_MODE -ErrorAction SilentlyContinue
Remove-Item Env:KAFKA_TOPIC_PARTITIONS -ErrorAction SilentlyContinue
Remove-Item Env:KAFKA_LISTENER_CONCURRENCY -ErrorAction SilentlyContinue
```

---

## 12. Troubleshooting FAQ

| Problem | Cause | Solution |
|---|---|---|
| **Port 8080 or 8081 already in use** | Another app or old container running | Run `docker ps` and `docker stop $(docker ps -q)` or check Task Manager. |
| **503 Service Unavailable on POST /api/orders** | In REST: Payment Service is down. In Kafka: Kafka broker is down or unreachable. | Run `docker compose ps` to verify all services are healthy. |
| **Orders created but no payments appear in Kafka** | `COMMUNICATION_MODE` mismatch or `payment-service` not joined to group. | Ensure `COMMUNICATION_MODE=KAFKA` on both services. Run `docker compose logs -f payment-service`. |
| **Vite runs on 5174 instead of 5173** | Another dev server is using 5173 | Normal behavior. Open `http://localhost:5174` in your browser. |
| **JMeter not recognized in PowerShell** | JMeter bin directory not in PATH | Install Apache JMeter 5.6.3 and add `C:\...\apache-jmeter-5.6.3\bin` to System Environment Variables. |
