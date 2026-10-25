# REST vs Kafka - Order Service + Payment Service

```text
microservices-research
├── docker-compose.yml        full environment (MySQL x2, Kafka, both services)
├── docker-compose.monitoring.yml  monitoring overlay (Prometheus, Grafana, cAdvisor)
├── order-service/            Java 21 / Spring Boot 3.3.5 Order Service
├── payment-service/          Java 21 / Spring Boot 3.3.5 Payment Service
├── frontend/                 React 19 + Vite Interactive Platform (port 5174)
├── loadtest/                 JMeter 5.6.3 test plans & PowerShell automation
├── monitoring/               Prometheus configs & Grafana dashboards (port 3000)
├── results/                  JMeter HTML reports & empirical CSV datasets
├── RESEARCH_REPORT.md        Complete Academic Research Paper & Dissertation
├── WORKING.md                Step-by-step Operations & Testing Runbook
└── Roadmap.md                Research Milestones & Viva Defense Guide
```

> **Quick Links:**
> - 📄 **Academic Paper:** [RESEARCH_REPORT.md](RESEARCH_REPORT.md)
> - 🛠️ **Operations Runbook:** [WORKING.md](WORKING.md)
> - 🗺️ **Roadmap & Viva Prep:** [Roadmap.md](Roadmap.md)
> - 🌐 **Interactive Dashboard:** `cd frontend; npm run dev` ➔ [http://localhost:5174/](http://localhost:5174/)

One switch decides the communication mechanism: **`communication.mode=REST|KAFKA`** (env `COMMUNICATION_MODE`, default `REST`). Everything else (order logic, payment logic, databases, JVM settings) is identical.

## 1. Message flow

**REST mode**
```text
POST /api/orders -> OrderController -> OrderService
   1. INSERT order (status PENDING, committed)
   2. RestPaymentCommunication: POST http://payment-service:8081/api/payments   (waits)
        -> PaymentController -> PaymentService.processPayment() -> SELECT + INSERT payment
   3. 201 Created returned to the client
```

**Kafka mode**
```text
POST /api/orders -> OrderController -> OrderService
   1. INSERT order (status PENDING, committed)
   2. KafkaPaymentCommunication -> OrderEventProducer: send(topic "orders", key=orderId, JSON event)
      waits for the broker acknowledgment (acks=all)
   3. 201 Created returned to the client            <- payment has NOT happened yet
   ...later, asynchronously:
   4. OrderEventConsumer (group payment-service-group) receives the event
   5. PaymentService.processPayment() -> SELECT + INSERT payment   (same method as REST)
```

```text
              ┌── PaymentController (REST) ──┐
              ▼                              │
        PaymentService.processPayment()      │      <- the ONLY payment logic
              ▲                              │
              └── OrderEventConsumer (Kafka) ┘
```

The Order Service does **not** update the order status after payment in either mode (that would add DB work to only one path). Payment results are read from the Payment Service (`GET /api/payments/order/{orderId}`).

## 2. Files created / modified

**order-service - created**
`communication/{PaymentCommunication, RestPaymentCommunication, KafkaPaymentCommunication, PaymentRestClientConfig, PaymentRequest}.java`,
`kafka/{OrderEventProducer, KafkaTopicConfig}.java`, `exception/PaymentCommunicationException.java`,
tests: `OrderCreatedEventTest`, `OrderEventProducerTest`, `RestPaymentCommunicationTest`, `KafkaModeIntegrationTest`.

**order-service - modified**
`pom.xml` (spring-kafka, spring-kafka-test), `application.properties`, `event/OrderCreatedEvent.java` (+`eventCreatedAt`), `service/OrderService.java` (uses `PaymentCommunication`; no longer `@Transactional` on create), `exception/GlobalExceptionHandler.java` (503), `OrderControllerIntegrationTest` (mocks `PaymentCommunication`, +2 tests), `application-test.properties`.
**Removed:** the placeholder `OrderEventPublisher` / `NoOpOrderEventPublisher` (replaced by `PaymentCommunication`).

**payment-service - created**
`event/OrderCreatedEvent.java`, `kafka/{OrderEventConsumer, KafkaConsumerConfig}.java`, `exception/DuplicatePaymentException.java`,
tests: `OrderEventConsumerTest`, `PaymentIdempotencyTest`, `KafkaConsumerIntegrationTest`.

**payment-service - modified**
`pom.xml`, `application.properties`, `entity/Payment.java` (+`eventCreatedAt`, `processedAt`), `dto/{CreatePaymentRequest, PaymentResponse}.java` (additive fields), `repository/PaymentRepository.java` (+`existsByOrderId`), `service/PaymentService.java`, `controller/PaymentController.java` (one line), `exception/GlobalExceptionHandler.java`, `application-test.properties`.

**root - created:** `docker-compose.yml`, this README.

## 3. Maven dependencies added (both services)

`org.springframework.kafka:spring-kafka` and `org.springframework.kafka:spring-kafka-test` (test scope). Versions come from the Spring Boot BOM.

## 4. Kafka configuration

| Where | Setting | Why |
|---|---|---|
| both | `spring.kafka.bootstrap-servers=${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}` | `kafka:9092` inside Docker |
| order | key `LongSerializer`, value `JsonSerializer` | key = orderId, JSON value |
| order | `acks=all`, `linger.ms=0` | explicit, so results do not depend on client defaults |
| order | `max.block.ms=5000`, `request.timeout.ms=5000`, `delivery.timeout.ms=10000` | fail in ~5-10 s when Kafka is down |
| order | `spring.json.add.type.headers=false` | no Java class names on the wire |
| payment | `group-id=payment-service-group`, `auto-offset-reset=earliest` | |
| payment | `ErrorHandlingDeserializer` wrapping `LongDeserializer` / `JsonDeserializer` | a bad message cannot jam the consumer |
| payment | `spring.json.value.default.type=...paymentservice.event.OrderCreatedEvent`, `use.type.headers=false`, trusted package | decouples the two services' classes |
| payment | `spring.kafka.listener.concurrency=3` | consumer threads |
| both | `kafka.topic.orders=orders` | topic name |

Topic `orders`: **3 partitions**, replication factor 1 (`KAFKA_TOPIC_PARTITIONS`, `KAFKA_LISTENER_CONCURRENCY`). Created by `kafka-init` in Compose, and by a `NewTopic` bean when running locally in KAFKA mode.

## 5. Docker Compose changes

New root `docker-compose.yml`: `order-mysql`, `payment-mysql`, `kafka` (official `apache/kafka:3.8.1`, single-node KRaft, no ZooKeeper), `kafka-init` (creates `orders`), `payment-service`, `order-service`.
- Containers talk via service names (`kafka:9092`, `payment-service:8081`, `*-mysql`). From your machine Kafka is `localhost:9092`.
- `kafka` and `kafka-init` are in the **`kafka` profile**: the REST experiment does not run an idle broker.
- Needs Docker Compose v2.20.2+.

## 6. Start the system

```bash
# REST experiment
docker compose up -d --build

# Kafka experiment (stop REST stack first, or use down -v between experiments)
docker compose down -v
COMMUNICATION_MODE=KAFKA docker compose --profile kafka up -d --build

docker compose logs -f order-service payment-service
docker compose --profile kafka down -v      # stop + wipe everything
```
Local (no Docker for the apps): `mvn spring-boot:run` in each service; add `COMMUNICATION_MODE=KAFKA` and a Kafka on `localhost:9092` for Kafka mode. Build/test: `mvn clean package` (tests use H2 and embedded Kafka; no MySQL/Kafka needed).

## 7. Example API calls

```bash
curl -i -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" \
  -d '{"customerId":101,"productId":501,"quantity":2,"amount":1500.00}'

curl -i http://localhost:8081/api/payments/order/1      # REST: present immediately. Kafka: appears moments later
curl -i http://localhost:8080/api/orders/1
```
Payment response now also contains `eventCreatedAt` and `processedAt`.

## 8. Example Kafka message

Key: `1` (orderId, Long). Value:
```json
{"orderId":1,"customerId":101,"productId":501,"quantity":2,"amount":1500.00,"eventCreatedAt":"2026-10-01T10:30:00.123456Z"}
```

## 9. Verify Kafka

```bash
K="docker exec kafka /opt/kafka/bin"

docker compose ps                                                       # kafka should be (healthy); kafka-init exited 0
$K/kafka-topics.sh --bootstrap-server localhost:9092 --list             # orders present
$K/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders

# messages (producer works)
$K/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 5 \
  --property print.key=true --property key.separator=" | " \
  --property key.deserializer=org.apache.kafka.common.serialization.LongDeserializer

# consumer group active, offsets and LAG (consumer works)
$K/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
$K/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group payment-service-group
```
`LAG = 0` means everything published has been consumed. Log lines per order: `Publishing OrderCreatedEvent for orderId=N` (order) -> `Received OrderCreatedEvent for orderId=N` -> `Payment processed for orderId=N` (payment).

## 10. Idempotency

`PaymentService.processPayment` first runs `existsByOrderId` (indexed SELECT); if a payment exists it throws `DuplicatePaymentException` without writing. A unique index on `payments.order_id` is the final guard if two duplicates race. REST maps the exception to `409`; the Kafka consumer catches it, logs `Duplicate OrderCreatedEvent ignored`, and moves on. Both modes run the same SELECT + INSERT. (This adds one SELECT compared to the first Payment Service version, in both modes.)

## 11. Measuring latency correctly

Two different things:

1. **API acknowledgment latency** (JMeter/Gatling response time of `POST /api/orders`)
   - REST: until the Payment Service has processed the payment.
   - Kafka: until the broker acknowledged the event. The payment is **not** done yet.
   These are not equivalent; never present them as the same quantity.
2. **End-to-end latency** = `processedAt - eventCreatedAt`, stored on every payment row.
   - `eventCreatedAt`: Order Service, after the order is saved, right before the HTTP call / Kafka send. Sent in the REST body and in the Kafka message.
   - `processedAt`: Payment Service, right before the payment INSERT. Same code for both modes.
   - Both are UTC `datetime(6)` (microseconds). Both containers share the host clock; across different machines, clock skew would corrupt the numbers.

```sql
-- run in payment-mysql: docker exec -it payment-mysql mysql -uroot -proot paymentdb
SELECT COUNT(*) AS n,
       AVG(TIMESTAMPDIFF(MICROSECOND, event_created_at, processed_at))/1000 AS avg_ms,
       MAX(TIMESTAMPDIFF(MICROSECOND, event_created_at, processed_at))/1000 AS max_ms
FROM payments WHERE event_created_at IS NOT NULL;
```
Throughput for Kafka: also check when the last payment landed (`MAX(processed_at)`), or watch consumer LAG reach 0. Truncate both tables (and `down -v`) between runs.

## 12. Failure behaviour

- **Kafka unavailable (Order Service):** `send` blocks up to `max.block.ms`/`delivery.timeout.ms` (5-10 s), then the API returns `503`; the order stays `PENDING`, no payment is triggered. No automatic re-publish (no outbox) - out of scope.
- **Kafka unavailable (Payment Service):** the app keeps running (REST endpoints work); the consumer logs connection warnings and reconnects when Kafka is back.
- **Payment Service down, Kafka up:** the Order API still returns 201; events accumulate in the topic. When the Payment Service starts, its group resumes from the last committed offset (or from the beginning for a brand-new group) and processes the backlog. Replays are harmless because of idempotency. In REST mode the same outage returns `503` to the client immediately - that is the recovery difference to measure.
- **Bad message:** malformed JSON is logged and skipped (no retry); an invalid event (null/zero amount) is warned and skipped; a processing failure (e.g. DB down) is retried 3 x 1 s, then logged at ERROR and skipped.
- **Dead-letter topic: deliberately not added.** The ERROR log names the skipped record; for this prototype an extra topic and consumer would only add experimental noise. Setting `kafka.consumer.retry.max-attempts` higher keeps retrying DB outages longer.
- **Delivery guarantee:** at-least-once (offsets committed after processing); duplicates are absorbed by idempotency. Not exactly-once.

## 13. Metrics

`/actuator/prometheus` on both services also exposes Kafka client metrics automatically (`kafka_producer_*` in the Order Service, `kafka_consumer_*` such as `kafka_consumer_fetch_manager_records_lag_max` in the Payment Service) plus Spring Kafka timers (`spring_kafka_template_seconds`, `spring_kafka_listener_seconds`). The REST client in the Order Service adds `http_client_requests_seconds`. No custom metrics were added.

## 14. Keeping the experiment fair

- Same JVM flags, same MySQL, same hardware in both runs; optionally cap CPU/RAM identically on the two services (`cpus`, `mem_limit` in compose).
- Kafka tunables are experiment parameters: `acks=all`, 3 partitions, 3 consumer threads. Record them in the report and keep them fixed. Note that REST processes requests on Tomcat's thread pool while Kafka processes on `partitions x concurrency` threads.
- Per-message INFO logs cost time. For load tests set `LOGGING_LEVEL_COM_EXAMPLE=WARN` on both services.
- In KAFKA mode the Kafka container uses extra CPU/RAM that does not exist in REST mode; that is part of the real cost of the Kafka approach and should be reported, not hidden.

## 15. Troubleshooting

| Symptom | Check |
|---|---|
| `POST /api/orders` -> 503 in REST mode | Payment Service not up / wrong `PAYMENT_SERVICE_URL`. |
| `POST /api/orders` -> 503 in Kafka mode | `docker compose ps` (kafka healthy?), `KAFKA_BOOTSTRAP_SERVERS` (`kafka:9092` in Docker, `localhost:9092` outside). Started without `--profile kafka`? |
| Order 201 but no payment (Kafka) | Is `COMMUNICATION_MODE=KAFKA` set for **both** services (`docker compose config | grep COMMUNICATION`)? Check `kafka-consumer-groups --describe` for the group and its lag; check payment-service logs. |
| `unknown profile`/`required` compose error | Update Docker Compose to v2.20.2+. |
| Switched modes but nothing changed | Env vars are read at container creation: `docker compose down` then `up` again. |
| `Unable to find a ... orders` / topic missing | `kafka-init` logs; or run the `kafka-topics.sh --create` command manually. |
| `409` on direct payment calls | The orderId already has a payment (by design). |
| Old rows have NULL `event_created_at` | Created before this change; filter `IS NOT NULL`. |
| Ports 3306/3307/8080/8081/9092 busy | Stop other stacks (e.g. the per-service compose files). |

## 16. React Demonstration Platform

A modern decoupled frontend dashboard built with React 19 and Vite is available in `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5174/` to:
- **Live Simulator:** Place sample orders, watch visual pipeline stages, and view real-time latency numbers.
- **Resilience Demo:** Test downstream failure behavior (REST 503 vs Kafka buffering).
- **Benchmark Analytics:** View interactive charts for latency, throughput, and CPU/RAM from the research CSVs.
- **Viva Defense:** Study Little's Law calculations and examiner defense questions.

