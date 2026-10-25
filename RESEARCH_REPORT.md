# Comparative Performance Evaluation of REST-Based and Event-Driven Communication in Microservice Architectures

**Academic Context:** Major Research Project Report | Course Code: SEC303 | Semester V – VI  
**Discipline:** Bachelor of Computer Applications (BCA) / Computer Science  
**Technology Implementation:** Java 21 · Spring Boot 3.3.5 · Apache Kafka 3.8.1 (KRaft) · MySQL 8.4 · Docker · JMeter 5.6.3 · Prometheus & Grafana · React 19  

---

## Abstract

Modern software engineering increasingly employs microservice architectures to decompose complex enterprise domains into independently deployable, loosely coupled services. A foundational architectural decision in these distributed systems is the selection of an inter-service communication mechanism: **synchronous REST over HTTP/1.1** versus **asynchronous, event-driven messaging via a message broker (Apache Kafka)**. 

While theoretical literature asserts that event-driven paradigms offer superior decoupling and throughput, empirical comparisons under strictly controlled, identical database logic and hardware conditions remain limited in undergraduate research. 

This study presents a controlled empirical evaluation comparing REST-based and Apache Kafka-based communication within a two-service prototype (**Order Service** and **Payment Service**) implemented in **Java 21 and Spring Boot 3.3.5**, containerized with **Docker**, and evaluated under progressive workloads (**100, 500, 1,000, and 5,000 requests** at 10 concurrent client threads) using **Apache JMeter 5.6.3**. Evaluated parameters include **API acknowledgment latency**, **end-to-end processing latency**, **client throughput (RPS)**, **container CPU and memory utilization**, and **fault-tolerance behavior under downstream outages**.

### Key Empirical Findings:
1. **API Acknowledgment Latency:** Kafka provides **30.0% to 45.2% lower client response latency** across workloads (e.g., $21.0\text{ ms} \pm 0.8\text{ ms}$ vs $38.3\text{ ms} \pm 4.8\text{ ms}$ at 5,000 requests) because the Order Service only waits for local database persistence and broker acknowledgment (`acks=all`), avoiding downstream execution delays.
2. **Client Throughput & Little's Law:** In accordance with Little’s Law ($\lambda = L / W$), Kafka achieves up to **$466.9\text{ requests/second}$**, representing a **$1.79\times$ throughput advantage** over REST ($260.2\text{ requests/second}$) under identical client concurrency ($L = 10$). Theoretical predictions align with experimental observations within $2\%$.
3. **The Consumer Parallelism Bottleneck:** In event-driven architectures, total transaction completion time is governed by consumer concurrency. Under 5,000 requests with 3 consumer threads, an accumulative consumer lag backlog caused end-to-end latency to rise to **$5,831.1\text{ ms} \pm 1,180\text{ ms}$**. Scaling the topic to 10 partitions and 10 consumer threads eliminated the backlog, reducing end-to-end latency to **$52.1\text{ ms} \pm 3.1\text{ ms}$**.
4. **End-to-End Latency Leader:** When services are healthy and unburdened by queue backlogs, synchronous REST completes the full transaction significantly faster (**$2.17\text{ ms} \pm 0.40\text{ ms}$** vs $52.1\text{ ms}$), avoiding message serialization, broker disk journaling, and consumer polling round-trips.
5. **Resilience & Fault Tolerance:** Under an induced downstream outage, REST experienced immediate cascading failure (**100% error rate with HTTP 503**), whereas Kafka demonstrated temporal decoupling (**0% client errors with HTTP 201**), successfully buffering 100 orders in the broker log and draining the backlog in $0.42\text{ seconds}$ upon service recovery with zero data loss.

---

## 1. Introduction & Theoretical Foundations

Microservice architectures decompose applications into autonomous services collaborating over network boundaries. The choice of inter-service transport fundamentally defines system coupling, scalability, and resilience.

### 1.1 Architectural Paradigms

```
Synchronous REST Model:
[Client] ──> [Order Service] ──(HTTP POST Blocking)──> [Payment Service] ──> [MySQL]
                 │                                             ▲
                 └───(MySQL: orders)                           │
                                                               │
Asynchronous Event-Driven Model (Kafka):                       │
[Client] ──> [Order Service] ──(Produce: acks=all)──> [Kafka Topic: orders]
                 │                                             │
                 └───(MySQL: orders)                           ▼
                                                       [OrderEventConsumer]
                                                               │
                                                               ▼
                                                       [Payment Service] ──> [MySQL]
```

1. **Synchronous REST over HTTP/1.1:** Request-driven communication where the caller blocks execution awaiting downstream computation. This introduces **temporal coupling**: both services must be simultaneously available and responsive.
2. **Asynchronous Messaging via Apache Kafka:** Event-driven communication where state changes are published as immutable events to an append-only distributed commit log. Consumers pull records at their own processing rate, establishing **temporal decoupling**.

### 1.2 Theoretical Comparison Matrix

| Evaluation Dimension | Synchronous REST (HTTP/1.1) | Event-Driven (Apache Kafka) |
|---|---|---|
| **Temporal Coupling** | **High:** Caller and callee must be online concurrently. | **Low:** Caller and callee operate independently in time. |
| **Thread Model** | Worker thread (Tomcat pool) remains occupied during I/O. | Upstream thread unblocks on broker ACK; downstream threads pool-based. |
| **Flow Control** | Push-based; high arrival rate risks downstream exhaustion. | Pull-based; consumer controls consumption rate via poll batching. |
| **System Overhead** | Minimal; point-to-point network calls, zero broker state. | Substantial; requires dedicated broker process, JVM heap, disk logs. |
| **Consistency Model** | Immediate Consistency (request confirms end-to-end state). | Eventual Consistency (processing confirmed asynchronously). |

---

## 2. Research Questions (RQs)

- **RQ1:** How does client-perceived API acknowledgment latency and request throughput compare between REST and Kafka across progressive request volumes (100 to 5,000 requests)?
- **RQ2:** What is the quantitative impact of consumer partition concurrency on true end-to-end processing latency in event-driven systems?
- **RQ3:** What is the total system resource utilization cost (CPU percentage and Memory MiB) incurred by deploying an intermediate message broker?
- **RQ4:** How do the two communication paradigms behave when a downstream microservice experiences an ungraceful outage during active client workloads?

---

## 3. Experimental Prototype & Controls

To eliminate confounding variables and ensure reproducibility, a minimal two-service prototype was constructed:
- **`Order Service` (Port 8080):** Upstream entry point handling order creation.
- **`Payment Service` (Port 8081):** Downstream service executing deterministic payment processing.

### 3.1 Strict Experimental Controls
1. **Identical Database Operations:**
   - In both modes, order creation executes **exactly 1 INSERT** into MySQL `orders` table.
   - In both modes, payment processing executes **exactly 1 SELECT (`existsByOrderId`) + 1 INSERT** into MySQL `payments` table.
   - The Order Service deliberately does not update its database to `PAID` after payment. Doing so in REST would add an extra `UPDATE` query that Kafka could not match without an asynchronous callback topic, unbalancing the database workload.
2. **Unified Single-Method Processing:**
   - Both `PaymentController.create` and `OrderEventConsumer.onMessage` invoke the identical business method: `PaymentService.processPayment(Long orderId, BigDecimal amount, Instant eventCreatedAt)`.
3. **Idempotency Guarantee:**
   - Deduplication is enforced by a database unique constraint on `payments.order_id` combined with an application-level `existsByOrderId` check, ensuring safe at-least-once delivery in Kafka.
4. **Microsecond Precision Timestamping:**
   - `eventCreatedAt`: Recorded in Order Service immediately prior to network dispatch.
   - `processedAt`: Recorded in Payment Service immediately prior to payment persistence.
   - Both containers run UTC microsecond clocks (`datetime(6)`) on the host system clock.
5. **Runtime Switch:**
   - A single environment variable `COMMUNICATION_MODE = REST | KAFKA` toggles the transport bean (`PaymentCommunication`) between `RestPaymentCommunication` and `KafkaPaymentCommunication`.

### 3.2 System Configuration & Tuning Parameters

| Component | Parameter | Configured Value | Academic Rationale |
|---|---|---|---|
| **JVM Runtime** | Java Version | OpenJDK 21.0.4 (Temurin) | Modern LTS release with virtual thread capabilities. |
| **JVM Flags** | Heap Allocation | `-XX:MaxRAMPercentage=75` | Prevents container OOM killer while utilizing available RAM. |
| **Tomcat (REST)** | `server.tomcat.threads.max` | 200 | Spring Boot default worker thread pool limit. |
| | `server.tomcat.threads.min-spare` | 10 | Baseline idle thread pool allocation. |
| **HikariCP (DB)** | `maximum-pool-size` | 10 | Matches default pool size to eliminate connection pool skew. |
| **Kafka Producer** | `acks` | `all` (-1) | Enforces full in-sync replica durability before ACK. |
| | `linger.ms` | `0` | Disables client batching delays for immediate dispatch. |
| | `batch.size` | `16384` (16 KB) | Standard Kafka producer buffer sizing. |
| | `compression.type` | `none` | Eliminates CPU compression variance across tests. |
| | `max.block.ms` | `5000` | Fails fast (~5s) during broker outages. |
| **Kafka Consumer** | `group-id` | `payment-service-group` | Dedicated consumer group identity. |
| | `auto-offset-reset` | `earliest` | Ensures full message replay upon group initialization. |
| | `concurrency` | `3` (Baseline) / `10` (Scaled) | Evaluates effect of consumer parallelism against producer rate. |

---

## 4. Experimental Setup & Methodology

### 4.1 Host Hardware & Infrastructure
- **Processor:** 12th Gen Intel Core i7 / AMD Ryzen 8-core CPU (Windows 11 Pro 64-bit)
- **Memory:** 16 GB DDR4 RAM
- **Container Platform:** Docker Engine v27.x with Docker Compose v2.20.2+
- **Database Engine:** MySQL 8.4 LTS (separate container instances for `orderdb` and `paymentdb`)
- **Broker Engine:** Apache Kafka 3.8.1 (Single-node KRaft mode, no ZooKeeper overhead)
- **Monitoring Stack:** Prometheus v2.55.1, Grafana 11.3.0, cAdvisor v0.49.1

### 4.2 Workload Matrix & Automation Protocol
Load experiments were automated using the PowerShell automation harness `loadtest/run-test.ps1`:
- **Workload Sizes:** 100, 500, 1,000, and 5,000 total HTTP requests.
- **Client Concurrency:** Fixed at 10 concurrent threads ($L = 10$).
- **Sample Repetitions:** 3 complete measured runs per workload cell ($N = 3$, excluding Run 0 warm-up).
- **JVM Warm-up:** 300 non-measured warm-up requests executed before every run to trigger JIT compilation.
- **State Reset:** Both MySQL tables (`orders` and `payments`) truncated via `TRUNCATE TABLE` prior to measurement.
- **Drain Verification:** Automation harness verifies that all generated orders are persisted in `payments` before compiling metrics.
- **Logging Level:** Configured to `WARN` across all Spring Boot packages to avoid console I/O latency skew.

---

## 5. Empirical Results & Comparative Analysis

### 5.1 Comprehensive Benchmark Summary Matrix

The table below presents the arithmetic mean and sample standard deviation ($\text{Mean} \pm \text{SD}$) across all 3 measured runs per workload configuration:

| Workload | Architecture Config | API Avg Latency (ms) | API p95 (ms) | Client Throughput (RPS) | End-to-End Latency (ms) | E2E p95 (ms) | Payments Completed / sec | Max Order CPU (%) | Max Payment CPU (%) | Max Kafka RAM (MiB) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **100** | **REST** | $41.7 \pm 2.8$ | $71.3 \pm 9.3$ | $223.6 \pm 17.3$ | **$4.86 \pm 1.76$** | $13.7 \pm 14.3$ | $246.4 \pm 19.3$ | 16.4% | 9.6% | *N/A* |
| **100** | **Kafka (3p / 3t)** | **$29.2 \pm 1.5$** | **$52.0 \pm 4.6$** | **$302.0 \pm 25.5$** | $158.7 \pm 14.4$ | $302.0 \pm 24.5$ | $175.4 \pm 8.2$ | 0.3% | 3.4% | 429 MiB |
| **500** | **REST** | $55.6 \pm 31.1$ | $137.5 \pm 130.0$ | $207.0 \pm 86.6$ | **$2.97 \pm 0.52$** | $4.57 \pm 1.61$ | $211.3 \pm 88.9$ | 174.7% | 153.3% | *N/A* |
| **500** | **Kafka (3p / 3t)** | **$36.5 \pm 24.1$** | **$93.9 \pm 93.7$** | **$331.4 \pm 156.4$** | $688.7 \pm 170.8$ | $1,164.8 \pm 208.5$ | $186.9 \pm 69.9$ | 42.7% | 91.3% | 460 MiB |
| **1,000** | **REST** | $36.5 \pm 1.9$ | $82.7 \pm 42.8$ | $263.9 \pm 12.0$ | **$2.19 \pm 0.25$** | $3.15 \pm 0.20$ | $266.4 \pm 12.2$ | 142.8% | 115.9% | *N/A* |
| **1,000** | **Kafka (3p / 3t)** | **$24.0 \pm 5.0$** | **$32.3 \pm 1.5$** | **$410.0 \pm 76.6$** | $1,145.1 \pm 60.0$ | $1,907.3 \pm 88.7$ | $227.8 \pm 23.5$ | 160.2% | 61.6% | 512 MiB |
| **1,000** | **Kafka (10p / 10t)** | $28.1 \pm 5.8$ | $43.0 \pm 11.5$ | $352.3 \pm 65.5$ | $55.8 \pm 1.2$ | $153.4 \pm 7.9$ | $351.0 \pm 60.8$ | 223.6% | 199.5% | 1,063 MiB |
| **5,000** | **REST** | $38.3 \pm 4.8$ | $53.7 \pm 4.1$ | $260.2 \pm 30.1$ | **$2.17 \pm 0.40$** | $3.68 \pm 0.85$ | $260.8 \pm 30.2$ | 238.3% | 158.2% | *N/A* |
| **5,000** | **Kafka (3p / 3t)** | $24.9 \pm 6.1$ | $34.3 \pm 6.0$ | $412.0 \pm 113.8$ | $5,831.1 \pm 1,180.2$ | $9,471.2 \pm 2,122.4$ | $241.6 \pm 35.5$ | 77.5% | 24.4% | 546 MiB |
| **5,000** | **Kafka (10p / 10t)** | **$21.0 \pm 0.8$** | **$29.3 \pm 1.5$** | **$466.9 \pm 19.7$** | $52.1 \pm 3.2$ | $146.3 \pm 9.4$ | **$467.1 \pm 18.3$** | 150.0% | 117.3% | 1,053 MiB |

---

### 5.2 Analysis 1: API Acknowledgment Latency & Little's Law Validation

**Observation:** Kafka consistently returned HTTP `201 Created` to the client faster than REST across all tested workload volumes:
- At 100 requests: Kafka was **30.0% faster** ($29.2\text{ ms}$ vs $41.7\text{ ms}$).
- At 500 requests: Kafka was **34.4% faster** ($36.5\text{ ms}$ vs $55.6\text{ ms}$).
- At 1,000 requests: Kafka was **34.3% faster** ($24.0\text{ ms}$ vs $36.5\text{ ms}$).
- At 5,000 requests: Kafka (10p/10t) was **45.2% faster** ($21.0\text{ ms}$ vs $38.3\text{ ms}$).

**Mechanistic Explanation:** In REST, the Order Service thread blocks waiting for the downstream HTTP network hop, payment bean initialization, and payment database write. In Kafka, the Order Service thread unblocks as soon as the local order is committed and the Kafka broker confirms record receipt (`acks=all`), decoupling client response time from downstream execution latency.

**Mathematical Proof via Little’s Law:**  
Little’s Law governs closed queuing systems:
$$L = \lambda \cdot W \implies \lambda = \frac{L}{W}$$
Where:
- $L = \text{Client Concurrency } (10\text{ threads})$
- $W = \text{Average Response Latency (seconds)}$
- $\lambda = \text{Client Throughput (Requests / second)}$

Applying Little's Law to the measured empirical means:
1. **REST at 5,000 requests:**
   $$\lambda_{\text{predicted}} = \frac{10}{0.03833\text{ s}} = 260.89\text{ req/s} \quad (\text{Observed: } 260.16\text{ req/s, Error: } 0.28\%)$$
2. **Kafka (10p / 10t) at 5,000 requests:**
   $$\lambda_{\text{predicted}} = \frac{10}{0.02100\text{ s}} = 476.19\text{ req/s} \quad (\text{Observed: } 466.90\text{ req/s, Error: } 1.95\%)$$

The experimental throughput aligns with Little’s Law within a $2\%$ error margin, validating the accuracy of the closed-loop load-testing model.

---

### 5.3 Analysis 2: End-to-End Latency & The Consumer Concurrency Bottleneck

A central contribution of this research is clarifying the operational difference between **API Latency** and **End-to-End Workflow Latency** ($T_{\text{e2e}} = \text{processedAt} - \text{eventCreatedAt}$).

```
End-to-End Latency vs Request Volume:
Latency (ms)
  6000 ┼                                                     ● Kafka (3p/3t: 5,831.1 ms)
  5000 ┼
  4000 ┼
  3000 ┼
  2000 ┼                                 ● Kafka (3p/3t: 1,145.1 ms)
  1000 ┼                    ● (688.7 ms)
     0 ┼──● REST (4.8ms)────● (2.9ms)────● (2.2ms)───────────● REST (2.17ms) / Kafka 10p (52.1ms)
       └──────100──────────────500────────────1,000──────────────────5,000 (Requests)
```

1. **REST Speed Advantage:** When downstream services are healthy, synchronous REST completes payment persistence in **$2.17\text{ ms}$** (mean across 5,000 requests).
2. **The 3-Thread Bottleneck:** In Kafka with 3 partitions and 3 threads, producer output ($\sim 412\text{ req/s}$) outpaces consumer capacity ($\sim 241\text{ pay/s}$). This creates an accumulating consumer lag backlog:
   - 100 requests: $158.7\text{ ms}$ E2E latency.
   - 500 requests: $688.7\text{ ms}$ E2E latency.
   - 1,000 requests: $1,145.1\text{ ms}$ E2E latency.
   - 5,000 requests: **$5,831.1\text{ ms}$** E2E latency (p95: $9,471.2\text{ ms}$).
3. **Resolution via Concurrency Scaling:** Scaling the topic to **10 partitions with 10 consumer threads** increased consumer processing capacity to **$467.1\text{ pay/s}$**, eliminating queue buildup and bringing end-to-end latency down to **$52.1\text{ ms}$**.

---

### 5.4 Analysis 3: Hardware Resource Overhead (CPU & Memory)

Evaluating total system cost reveals the resource trade-offs inherent in message brokers:

1. **Memory (RAM) Footprint:**
   - Both Spring Boot microservices consume $\sim 410$ to $513\text{ MiB}$ of RAM in both modes.
   - **REST Mode:** Requires zero broker containers. Total cluster memory $\approx 850\text{ to } 960\text{ MiB}$.
   - **Kafka Mode:** The Kafka KRaft broker container requires **$429\text{ to } 546\text{ MiB}$** with 3 partitions, and **$1,053\text{ to } 1,063\text{ MiB}$** when scaled to 10 partitions. Deploying Kafka increases the overall system memory footprint by $\sim 110\%$.
2. **CPU Peak Consumption:**
   - In REST mode, CPU spikes concentrate on Tomcat worker threads and HikariCP database pool management (up to 238.3% on Order Service under 5,000 requests).
   - In Kafka mode, CPU utilization is divided across producer JSON serialization, broker segment journaling, and consumer poll loops.

---

### 5.5 Analysis 4: Downstream Failure & Fault Tolerance Evaluation (RQ4)

To fulfill **Objective #4**, an experimental outage was induced by halting the Payment Service container (`docker stop payment-service`) while dispatching an identical batch of 100 client orders:

| Measured Metric | Synchronous REST Mode | Event-Driven Kafka Mode |
|---|---|---|
| **Orders Dispatched** | 100 requests | 100 requests |
| **HTTP Response Status** | `HTTP 503 Service Unavailable` | `HTTP 201 Created` |
| **Client Error Rate** | **100% Failure** (100 errors) | **0% Failure** (0 errors) |
| **Upstream Service Impact** | Tomcat request threads blocked until HTTP connection timeout. | Order persisted to MySQL; event committed to Kafka topic. |
| **Peak Consumer Lag** | *N/A* (No broker) | Exactly 100 unconsumed records buffered in broker. |
| **Recovery Phase (`docker start`)**| Manual client retry required; lost state synchronization. | Consumer joined group; processed 100 orders in **$0.42\text{ seconds}$** ($238\text{ pay/s}$). |
| **Final Payments Persisted** | 0 payments | **100 / 100 payments (0% Data Loss)** |

**Conclusion:** Kafka provides robust **temporal decoupling**. A downstream failure does not degrade upstream ingestion or result in data loss.

---

## 6. Architectural Decision Framework

Based on our empirical observations, the following decision criteria guide inter-service communication selection:

```
                                  Decision Tree
                                        │
                      Is immediate data consistency 
                      strictly required by the caller?
                                       ╱ ╲
                                     YES  NO
                                     ╱     ╲
                           Use Synchronous  Do downstream operations 
                           REST over HTTP   require high client throughput 
                                            or independent scaling?
                                                   ╱ ╲
                                                 YES  NO
                                                 ╱     ╲
                                          Use Apache   Use Lightweight 
                                          Kafka        REST / Queues
```

- **Select Synchronous REST when:**
  - Strict immediate consistency is required (e.g., synchronous inventory reservation or financial authorization).
  - Simplicity and low operational overhead are primary goals (zero broker infrastructure, low memory footprint).
  - Traffic volume is low to moderate and sub-5ms end-to-end processing is necessary.
- **Select Event-Driven Kafka when:**
  - High client ingestion throughput is required (e.g., order capture, telemetry streams).
  - Downstream services experience intermittent downtime or variable processing latency.
  - One domain event must trigger multiple independent downstream consumers (publish-subscribe).
  - Teams possess the operational capacity to manage broker RAM, storage retention, and partition scaling.

---

## 7. Threats to Validity & Limitations

1. **Single-Node Virtualization:** All containers ran on a single physical host connected via Docker virtual bridges. In a distributed multi-node cloud environment, physical network latency would penalize synchronous REST round-trips more severely than local broker connections.
2. **Deterministic Downstream Execution:** Payment processing was modeled as a local database insert without external payment gateway delays (Stripe/PayPal), which would increase REST thread blocking in real-world deployments.
3. **Fixed Client Concurrency:** Experiments maintained a fixed client concurrency of 10 threads ($L = 10$). High-concurrency sweeps (50 to 500 threads) would likely trigger earlier Tomcat thread pool exhaustion in REST.

---

## 8. Conclusion

This research conducted an empirical performance evaluation of synchronous REST versus asynchronous Kafka communication in a containerized Java 21 / Spring Boot 3.3 microservice environment.

The empirical data demonstrates that **neither architecture is universally superior**:
- **Apache Kafka provides substantial advantages in client-facing throughput ($1.79\times$), API acknowledgment latency ($45.2\%$ faster), and fault tolerance ($0\%$ client errors during downstream outages).**
- **Synchronous REST delivers superior end-to-end processing latency ($2.17\text{ ms}$ vs $52.1\text{ ms}$) and avoids the substantial hardware overhead of a message broker ($\sim 1\text{ GB}$ less RAM).**

Crucially, the findings indicate that event-driven messaging is not an automatic remedy for latency: without adequate consumer partition concurrency to balance producer rates, message brokers simply convert client wait times into multi-second consumer lag backlogs.

---

## 9. References

1. Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems* (2nd ed.). O'Reilly Media.
2. Kleppmann, M. (2017). *Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems*. O'Reilly Media.
3. Little, J. D. C. (1961). "A Proof for the Queuing Formula: $L = \lambda W$." *Operations Research*, 9(3), 383–387.
4. Richardson, C. (2018). *Microservices Patterns: With Examples in Java*. Manning Publications.
5. Blinowski, G., Ojdana, A., & Sobczak, P. (2022). "Monolithic vs. Microservice Architecture: A Performance and Scalability Evaluation." *IEEE Access*, 10, 20357–20374.
6. Villamizar, M., et al. (2017). "Evaluating the Monolithic and the Microservice Architecture Pattern to Deploy Web Applications in the Cloud." In *Proc. IEEE 10th Int. Conf. on Cloud Computing (CLOUD)*, 585–592.
7. Haselböck, S., Weinreich, R., & Buchgeher, G. (2018). "Decision Guidance Models for Microservice Architecture: A Systematic Review." *Computing*, Springer, 100(10), 1075–1110.
8. Balalaie, A., Heydarnoori, A., & Jamshidi, P. (2016). "Microservices Architecture Enables DevOps: Migration Experiences in Practice." *IEEE Software*, 33(3), 42–52.
9. Apache Kafka Documentation. (2024). *Kafka KRaft Mode and Consumer Architecture*. Apache Software Foundation.
10. Spring Boot Reference Documentation. (2024). *Spring for Apache Kafka & Spring WebMVC*. VMware Tanzu.
