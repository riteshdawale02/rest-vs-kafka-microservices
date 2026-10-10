package com.example.orderservice.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

// "order" is a reserved word in SQL, so the table is named "orders".
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long customerId;

    @Column(nullable = false)
    private Long productId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Order() {
        // required by JPA
    }

    public Order(Long customerId, Long productId, Integer quantity, BigDecimal amount) {
        this.customerId = customerId;
        this.productId = productId;
        this.quantity = quantity;
        this.amount = amount;
        this.status = OrderStatus.PENDING;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getCustomerId() { return customerId; }
    public Long getProductId() { return productId; }
    public Integer getQuantity() { return quantity; }
    public BigDecimal getAmount() { return amount; }
    public OrderStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setStatus(OrderStatus status) { this.status = status; }
}
