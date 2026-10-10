package com.example.orderservice.dto;

import com.example.orderservice.entity.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusRequest(@NotNull OrderStatus status) {
}
