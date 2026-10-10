package com.example.orderservice.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record CreateOrderRequest(
        @NotNull @Positive Long customerId,
        @NotNull @Positive Long productId,
        @NotNull @Positive Integer quantity,
        @NotNull @Positive BigDecimal amount
) {
}
