package com.example.paymentservice.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.Instant;

public record CreatePaymentRequest(
        @NotNull @Positive Long orderId,
        @NotNull @Positive BigDecimal amount,
        // optional: sent by the Order Service so REST and Kafka can be timed identically
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant eventCreatedAt
) {
}
