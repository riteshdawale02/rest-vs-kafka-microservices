package com.example.orderservice.communication;

import com.example.orderservice.event.OrderCreatedEvent;

/**
 * How the Order Service hands an order over to the Payment Service.
 * Exactly one implementation is active, selected by communication.mode (REST | KAFKA).
 */
public interface PaymentCommunication {

    /**
     * REST: returns after the Payment Service has processed the payment (HTTP 2xx).
     * KAFKA: returns after the broker has acknowledged the event (payment happens later).
     *
     * @throws com.example.orderservice.exception.PaymentCommunicationException on failure
     */
    void sendPayment(OrderCreatedEvent event);
}
