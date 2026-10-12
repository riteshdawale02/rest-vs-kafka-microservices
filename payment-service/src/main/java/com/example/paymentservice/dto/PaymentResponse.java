package com.example.paymentservice.dto;

import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.PaymentStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

public record PaymentResponse(
        Long id,
        Long orderId,
        BigDecimal amount,
        PaymentStatus status,
        LocalDateTime createdAt,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant eventCreatedAt,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant processedAt
) {
    public static PaymentResponse from(Payment p) {
        return new PaymentResponse(p.getId(), p.getOrderId(), p.getAmount(), p.getStatus(),
                p.getCreatedAt(), p.getEventCreatedAt(), p.getProcessedAt());
    }
}
