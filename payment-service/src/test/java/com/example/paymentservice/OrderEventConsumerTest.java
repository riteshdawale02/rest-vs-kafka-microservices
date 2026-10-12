package com.example.paymentservice;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.paymentservice.event.OrderCreatedEvent;
import com.example.paymentservice.exception.DuplicatePaymentException;
import com.example.paymentservice.kafka.OrderEventConsumer;
import com.example.paymentservice.service.PaymentService;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrderEventConsumerTest {

    @Mock
    private PaymentService paymentService;

    private final Instant created = Instant.parse("2026-10-01T10:30:00.123456Z");
    private final OrderCreatedEvent event =
            new OrderCreatedEvent(10L, 101L, 501L, 2, new BigDecimal("1500.00"), created);

    @Test
    void onOrderCreated_delegatesToPaymentService() {
        new OrderEventConsumer(paymentService).onOrderCreated(event);

        verify(paymentService).processPayment(10L, new BigDecimal("1500.00"), created);
    }

    @Test
    void onOrderCreated_ignoresDuplicate() {
        when(paymentService.processPayment(10L, new BigDecimal("1500.00"), created))
                .thenThrow(new DuplicatePaymentException(10L));

        assertDoesNotThrow(() -> new OrderEventConsumer(paymentService).onOrderCreated(event));
    }

    @Test
    void onOrderCreated_skipsInvalidEvent() {
        OrderEventConsumer consumer = new OrderEventConsumer(paymentService);

        consumer.onOrderCreated(new OrderCreatedEvent(10L, 101L, 501L, 2, BigDecimal.ZERO, created));
        consumer.onOrderCreated(null);

        verify(paymentService, never()).processPayment(any(), any(), any());
    }
}
