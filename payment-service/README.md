# Payment Service

> Kafka consumer added. `processPayment` is now idempotent (SELECT + INSERT) and records `eventCreatedAt`/`processedAt`. See the root `README.md`.

## 1. Purpose

Downstream service for the research project **"Comparative Performance Evaluation of REST-Based and Event-Driven Communication in Microservice Architectures."**
It simulates payment processing deterministically so the same service can be used unchanged in both experiments (REST and Kafka). The communication mechanism must be the only experimental variable.

## 2. Technology stack

Java 21 · Spring Boot 3.3 · Spring Web · Spring Data JPA · MySQL 8 · Bean Validation · Actuator · Micrometer Prometheus · Maven · Docker.
Tests use JUnit 5, MockMvc and in-memory H2 (test profile only).

## 3. Project structure

```text
payment-service
├── pom.xml, Dockerfile, docker-compose.yml, README.md
└── src
    ├── main/java/com/example/paymentservice
    │   ├── PaymentServiceApplication.java
    │   ├── controller/PaymentController.java
    │   ├── service/PaymentService.java        <-- processPayment(...) lives here
    │   ├── repository/PaymentRepository.java
    │   ├── entity/{Payment, PaymentStatus}.java
    │   ├── dto/{CreatePaymentRequest, UpdatePaymentStatusRequest, PaymentResponse}.java
    │   └── exception/{GlobalExceptionHandler, ErrorResponse, PaymentNotFoundException}.java
    ├── main/resources/application.properties
    └── test/...  (PaymentControllerIntegrationTest, PaymentServiceTest, application-test.properties)
```

## 4. Database setup

Database `paymentdb`, table `payments` (auto-created by Hibernate, `ddl-auto=update`).
The default JDBC URL has `createDatabaseIfNotExist=true`, so you only need MySQL running. Or create it manually:

```sql
CREATE DATABASE paymentdb;
```

Environment variables: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (defaults: localhost, root/root). `SERVER_PORT` defaults to **8081** so it can run beside the Order Service (8080).
`order_id` has a **unique constraint**: one payment per order. A duplicate returns `409 Conflict`.

## 5. Run locally

```bash
mvn clean package        # tests use H2, no MySQL needed
mvn spring-boot:run      # needs MySQL on localhost:3306
```

## 6. Run with Docker

```bash
docker compose up --build
docker compose down -v   # stop and delete data
```

Service: `http://localhost:8081`. MySQL is published on host port **3307** to avoid clashing with the Order Service's MySQL.

## 7. API documentation

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/payments` | `{"orderId":1,"amount":1500.00}` | 201 | 400 validation, 409 duplicate order |
| GET | `/api/payments/{id}` | – | 200 | 404 |
| GET | `/api/payments/order/{orderId}` | – | 200 | 404 |
| PATCH | `/api/payments/{id}/status` | `{"status":"SUCCESS"}` | 200 | 400 invalid status, 404 |

Statuses: `PENDING`, `SUCCESS`, `FAILED`. Validation: `orderId > 0`, `amount > 0`, status must be a valid enum value.

Payment response:

```json
{ "id": 1, "orderId": 1, "amount": 1500.00, "status": "SUCCESS", "createdAt": "2026-10-01T10:30:00" }
```

Error response:

```json
{ "timestamp": "2026-10-01T10:30:00", "status": 404, "message": "Payment not found", "path": "/api/payments/100" }
```

Processing is simulated: every valid request becomes `SUCCESS` with exactly one INSERT. No delays, randomness, caching, or external calls.

## 8. Example curl commands

```bash
curl -i -X POST http://localhost:8081/api/payments \
  -H "Content-Type: application/json" \
  -d '{"orderId":1,"amount":1500.00}'

curl -i http://localhost:8081/api/payments/1
curl -i http://localhost:8081/api/payments/order/1

curl -i -X PATCH http://localhost:8081/api/payments/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"FAILED"}'

# validation error (400)
curl -i -X POST http://localhost:8081/api/payments \
  -H "Content-Type: application/json" \
  -d '{"orderId":-1,"amount":0}'
```

## 9. Actuator endpoints

```bash
curl http://localhost:8081/actuator/health
curl http://localhost:8081/actuator/metrics
curl http://localhost:8081/actuator/metrics/http.server.requests
curl http://localhost:8081/actuator/prometheus
```

Metrics include HTTP request count and latency histograms, JVM memory/GC/threads, CPU, and Hikari connection pool stats, tagged `application="payment-service"`.
Prometheus scrape config:

```yaml
- job_name: payment-service
  metrics_path: /actuator/prometheus
  scrape_interval: 5s
  static_configs:
    - targets: ["payment-service:8081"]
```

## 10. Later Kafka integration

All payment logic is in one method:

```java
PaymentResponse PaymentService.processPayment(Long orderId, BigDecimal amount)
```

```text
 REST Controller  ──┐
                    ├──►  PaymentService.processPayment()  ──►  PaymentRepository ──► MySQL
 Kafka Consumer   ──┘
```

To add Kafka later, add `spring-kafka` and a listener class such as:

```java
@KafkaListener(topics = "orders")
public void onOrder(OrderEvent e) {
    paymentService.processPayment(e.orderId(), e.amount());
}
```

No change to `PaymentService`, the entity, or the repository is needed. Because of the unique `order_id`, a redelivered event fails with a constraint violation rather than creating a second payment; catch `DataIntegrityViolationException` in the consumer and treat it as "already processed".

## 11. Role in the REST-vs-Kafka experiment

- **REST run:** Order Service → HTTP `POST /api/payments` → this service.
- **Kafka run:** Order Service → topic `orders` → Kafka consumer → `processPayment()`.

The payment work is identical in both runs (one INSERT, deterministic result), so differences in latency, throughput, and resource use are attributable to the communication mechanism. Keep the same MySQL version, JVM flags, hardware, and warm-up in both runs.

**Load-test note:** each payment needs a unique `orderId`. When load-testing this service directly with JMeter or Gatling, generate unique IDs (e.g. a counter variable) or you will get `409` responses. Clear the `payments` table between runs.
