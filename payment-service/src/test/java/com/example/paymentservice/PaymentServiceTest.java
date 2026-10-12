package com.example.paymentservice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.example.paymentservice.dto.PaymentResponse;
import com.example.paymentservice.entity.PaymentStatus;
import com.example.paymentservice.service.PaymentService;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Calls processPayment directly, exactly as a future Kafka consumer would. */
@SpringBootTest
@ActiveProfiles("test")
class PaymentServiceTest {

    @Autowired
    private PaymentService paymentService;

    @Test
    void processPayment_succeedsDeterministically() {
        PaymentResponse r = paymentService.processPayment(5001L, new BigDecimal("250.00"));
        assertNotNull(r.id());
        assertEquals(5001L, r.orderId());
        assertEquals(PaymentStatus.SUCCESS, r.status());
    }
}
