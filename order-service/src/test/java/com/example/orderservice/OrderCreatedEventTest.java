package com.example.orderservice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.example.orderservice.entity.Order;
import com.example.orderservice.event.OrderCreatedEvent;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OrderCreatedEventTest {

    @Test
    void from_mapsOnlyPaymentRelevantFields() {
        Order order = new Order(101L, 501L, 2, new BigDecimal("1500.00"));
        ReflectionTestUtils.setField(order, "id", 10L);

        OrderCreatedEvent event = OrderCreatedEvent.from(order);

        assertEquals(10L, event.orderId());
        assertEquals(101L, event.customerId());
        assertEquals(501L, event.productId());
        assertEquals(2, event.quantity());
        assertEquals(new BigDecimal("1500.00"), event.amount());
        assertNotNull(event.eventCreatedAt());
    }
}
