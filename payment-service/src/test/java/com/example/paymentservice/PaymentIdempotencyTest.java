package com.example.paymentservice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.paymentservice.event.OrderCreatedEvent;
import com.example.paymentservice.exception.DuplicatePaymentException;
import com.example.paymentservice.kafka.OrderEventConsumer;
import com.example.paymentservice.repository.PaymentRepository;
import com.example.paymentservice.service.PaymentService;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class PaymentIdempotencyTest {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private PaymentRepository repository;

    private long countFor(long orderId) {
        return repository.findAll().stream().filter(p -> p.getOrderId().equals(orderId)).count();
    }

    @Test
    void processPayment_sameOrderTwice_createsOnlyOnePayment() {
        paymentService.processPayment(8001L, new BigDecimal("100.00"));

        assertThrows(DuplicatePaymentException.class,
                () -> paymentService.processPayment(8001L, new BigDecimal("100.00")));

        assertEquals(1, countFor(8001L));
    }

    @Test
    void consumer_sameEventTwice_createsOnlyOnePayment() {
        OrderEventConsumer consumer = new OrderEventConsumer(paymentService);
        OrderCreatedEvent event =
                new OrderCreatedEvent(8002L, 101L, 501L, 2, new BigDecimal("1500.00"), Instant.now());

        consumer.onOrderCreated(event);
        consumer.onOrderCreated(event); // duplicate delivery

        assertEquals(1, countFor(8002L));
    }
}
