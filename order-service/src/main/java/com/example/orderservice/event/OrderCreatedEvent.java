package com.example.orderservice.event;

import com.example.orderservice.entity.Order;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * "An order was created" - the only payload sent to the Payment Service,
 * over REST (as the request body) and over Kafka (as the message value).
 *
 * eventCreatedAt = the instant the Order Service finished saving the order and
 * created this event, immediately before handing it to the transport (HTTP or Kafka).
 * It is the start point for end-to-end latency measurement.
 */
public record OrderCreatedEvent(
        Long orderId,
        Long customerId,
        Long productId,
        Integer quantity,
        BigDecimal amount,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant eventCreatedAt
) {
    public static OrderCreatedEvent from(Order o) {
        return new OrderCreatedEvent(o.getId(), o.getCustomerId(), o.getProductId(),
                o.getQuantity(), o.getAmount(), Instant.now());
    }
}
