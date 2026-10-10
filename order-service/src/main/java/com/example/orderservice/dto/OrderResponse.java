package com.example.orderservice.dto;

import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record OrderResponse(
        Long id,
        Long customerId,
        Long productId,
        Integer quantity,
        BigDecimal amount,
        OrderStatus status,
        LocalDateTime createdAt
) {
    public static OrderResponse from(Order o) {
        return new OrderResponse(o.getId(), o.getCustomerId(), o.getProductId(),
                o.getQuantity(), o.getAmount(), o.getStatus(), o.getCreatedAt());
    }
}
