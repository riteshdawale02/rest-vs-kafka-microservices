package com.example.orderservice.communication;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;

/** Body of POST /api/payments on the Payment Service. */
public record PaymentRequest(
        Long orderId,
        BigDecimal amount,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant eventCreatedAt
) {
}
