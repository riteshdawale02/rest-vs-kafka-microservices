# Order Service

> Kafka support was added. See the root `README.md` for the REST/Kafka switch, Docker Compose and measurement notes. Section 7 below (placeholder hook) is superseded by `PaymentCommunication`.

Baseline Order Service for the research project **"Comparative Performance Evaluation of REST-Based and Event-Driven Communication in Microservice Architectures."**
Java 21 · Spring Boot 3.3 · Spring Web · Spring Data JPA · MySQL · Actuator · Micrometer Prometheus.

Lombok is intentionally not used: DTOs are Java records and the entity needs only a few accessors.

## 1. Project structure

```text
order-service
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── README.md
└── src
    ├── main
    │   ├── java/com/example/orderservice
    │   │   ├── OrderServiceApplication.java
    │   │   ├── controller/OrderController.java
    │   │   ├── service/OrderService.java
    │   │   ├── repository/OrderRepository.java
    │   │   ├── entity/{Order, OrderStatus}.java
    │   │   ├── dto/{CreateOrderRequest, UpdateOrderStatusRequest, OrderResponse}.java
    │   │   ├── event/{OrderCreatedEvent, OrderEventPublisher, NoOpOrderEventPublisher}.java
    │   │   └── exception/{GlobalExceptionHandler, ErrorResponse, OrderNotFoundException}.java
    │   └── resources/application.properties
    └── test
        ├── java/.../OrderControllerIntegrationTest.java
        └── resources/application-test.properties   (H2, test profile only)
```

## 2. What each class does

| Class | Role |
|---|---|
| `OrderServiceApplication` | Spring Boot entry point. |
| `OrderController` | HTTP layer: validates input, delegates to the service, picks status codes. |
| `OrderService` | All order business logic (create, read, update status). Transaction boundaries live here. |
| `OrderRepository` | Spring Data JPA repository (`save`, `findById`, `findAll`). |
| `Order` / `OrderStatus` | JPA entity (table `orders`, since `order` is an SQL keyword) and enum `PENDING, PAID, FAILED`. |
| `CreateOrderRequest`, `UpdateOrderStatusRequest` | Request DTOs with Bean Validation. |
| `OrderResponse` | Response DTO, so the entity is never exposed. |
| `OrderCreatedEvent` | The payload that will go to the Kafka topic `orders`. |
| `OrderEventPublisher` / `NoOpOrderEventPublisher` | Extension point. Does nothing now, so the baseline carries no overhead. |
| `GlobalExceptionHandler`, `ErrorResponse`, `OrderNotFoundException` | Clean JSON errors (400 / 404 / 500). |

## 3. Request-response flow: `POST /api/orders`

1. `OrderController.create` receives JSON and Spring validates it (`@Valid`). Failure returns `400`.
2. `OrderService.createOrder` starts a transaction and builds an `Order` (status `PENDING`, `createdAt = now`).
3. `OrderRepository.save` runs one `INSERT`; MySQL generates the ID (`AUTO_INCREMENT`).
4. The service calls `eventPublisher.publishOrderCreated(...)` (no-op today).
5. The transaction commits, an `OrderResponse` is returned, and the controller replies `201 Created` with a `Location` header.

## 4. Database interaction

- Table `orders` is auto-created by Hibernate (`ddl-auto=update`) in database `orderdb`.
- Create = 1 INSERT. Get by id = 1 SELECT. List = 1 SELECT. Status update = 1 SELECT + 1 UPDATE (JPA dirty checking).
- `spring.jpa.open-in-view=false` avoids holding a DB connection for the whole request.
- Credentials come from `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (defaults: localhost, root/root).
- `GET /api/orders` is unbounded by design (as specified). Keep the table small, or truncate it between load-test runs.

## 5. How Actuator exposes metrics

`spring-boot-starter-actuator` adds `/actuator/*` endpoints and Micrometer collects metrics automatically:
`http.server.requests` (count, latency, percentile histogram buckets), `jvm.*` (memory, GC, threads), `system.*` / `process.*` (CPU), and `hikaricp.*` (DB pool).
Exposed endpoints: `/actuator/health`, `/actuator/metrics`, `/actuator/prometheus`.
All metrics carry the tag `application="order-service"`.

## 6. How Prometheus will collect them

`micrometer-registry-prometheus` renders all metrics at `/actuator/prometheus` in Prometheus text format. Later, add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: order-service
    metrics_path: /actuator/prometheus
    scrape_interval: 5s
    static_configs:
      - targets: ["order-service:8080"]
```

## 7. Later connection to the Payment Service

The service/controller code stays unchanged; only the "notify payment" step is added behind an interface.

- **REST variant:** add a `PaymentClient` (e.g. `RestClient`) called from `OrderService.createOrder`, then update status to `PAID`/`FAILED` from the response.
- **Kafka variant:** add `KafkaOrderEventPublisher implements OrderEventPublisher`, annotated `@Primary`, that sends `OrderCreatedEvent` to topic `orders` via `KafkaTemplate`. A listener in this service can consume the Payment Service's result and call `updateStatus`.
- For Kafka, publish **after commit** (`@TransactionalEventListener(phase = AFTER_COMMIT)` or `TransactionSynchronizationManager`) so consumers never see an uncommitted order.
- Switch variants with a Spring profile (e.g. `rest` / `kafka`) to keep everything else identical across experiments.

## 8. Run locally

Prerequisites: JDK 21, Maven 3.9+, MySQL 8 on `localhost:3306`.

```bash
# optional overrides
export DB_URL="jdbc:mysql://localhost:3306/orderdb?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true"
export DB_USERNAME=root
export DB_PASSWORD=root

mvn clean package        # runs tests against in-memory H2, no MySQL needed
mvn spring-boot:run      # needs MySQL
```

The app listens on `http://localhost:8080`.

## 9. Run with Docker

```bash
docker compose up --build
# stop and remove data:
docker compose down -v
```

## 10. Example curl commands

```bash
# Create order (201)
curl -i -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":101,"productId":501,"quantity":2,"amount":1500.00}'

# Get one order (200 / 404)
curl -i http://localhost:8080/api/orders/1

# Get all orders (200)
curl -i http://localhost:8080/api/orders

# Update status (200 / 400 / 404)
curl -i -X PATCH http://localhost:8080/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"PAID"}'

# Validation error (400)
curl -i -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":-1,"productId":501,"quantity":0,"amount":0}'

# Actuator
curl http://localhost:8080/actuator/health
curl http://localhost:8080/actuator/metrics
curl http://localhost:8080/actuator/metrics/http.server.requests
curl http://localhost:8080/actuator/prometheus
```

Error response shape:

```json
{ "timestamp": "2026-10-01T10:30:00", "status": 404, "message": "Order not found", "path": "/api/orders/10" }
```

## Experimental-fairness notes

No caching, delays, external calls, or extra queries. Keep identical JVM flags, DB, and hardware for both the REST and Kafka runs, and warm up the service before measuring.
