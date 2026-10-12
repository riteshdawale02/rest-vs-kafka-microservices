package com.example.paymentservice.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // One payment per order. The unique constraint is the final idempotency guard.
    @Column(nullable = false, unique = true)
    private Long orderId;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** When the Order Service created the event (set by the sender; same meaning for REST and Kafka). */
    @Column(updatable = false)
    private Instant eventCreatedAt;

    /** When the Payment Service started persisting the payment (just before the INSERT). */
    @Column(updatable = false)
    private Instant processedAt;

    protected Payment() {
        // required by JPA
    }

    public Payment(Long orderId, BigDecimal amount, PaymentStatus status) {
        this(orderId, amount, status, null);
    }

    public Payment(Long orderId, BigDecimal amount, PaymentStatus status, Instant eventCreatedAt) {
        this.orderId = orderId;
        this.amount = amount;
        this.status = status;
        this.createdAt = LocalDateTime.now();
        this.eventCreatedAt = eventCreatedAt;
        this.processedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getOrderId() { return orderId; }
    public BigDecimal getAmount() { return amount; }
    public PaymentStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Instant getEventCreatedAt() { return eventCreatedAt; }
    public Instant getProcessedAt() { return processedAt; }

    public void setStatus(PaymentStatus status) { this.status = status; }
}
