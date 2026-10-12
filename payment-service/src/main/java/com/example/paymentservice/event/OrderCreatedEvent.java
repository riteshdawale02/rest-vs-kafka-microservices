package com.example.paymentservice.event;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;

/** Message value on the Kafka topic "orders". Mirrors the Order Service's event. */
public record OrderCreatedEvent(
        Long orderId,
        Long customerId,
        Long productId,
        Integer quantity,
        BigDecimal amount,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant eventCreatedAt
) {
}
