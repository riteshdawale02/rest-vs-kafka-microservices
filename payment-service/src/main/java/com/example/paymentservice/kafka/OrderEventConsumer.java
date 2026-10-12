package com.example.paymentservice.kafka;

import com.example.paymentservice.event.OrderCreatedEvent;
import com.example.paymentservice.exception.DuplicatePaymentException;
import com.example.paymentservice.service.PaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Receives OrderCreatedEvent and delegates to PaymentService.processPayment(...),
 * the same method the REST controller calls. No payment logic lives here.
 * Active only when communication.mode=KAFKA.
 */
@Component
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "KAFKA")
public class OrderEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventConsumer.class);

    private final PaymentService paymentService;

    public OrderEventConsumer(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    // group id comes from spring.kafka.consumer.group-id (payment-service-group)
    @KafkaListener(topics = "${kafka.topic.orders:orders}")
    public void onOrderCreated(OrderCreatedEvent event) {
        if (event == null || event.orderId() == null || event.amount() == null || event.amount().signum() <= 0) {
            log.warn("Ignoring invalid OrderCreatedEvent");
            return; // retrying can never fix an invalid payload
        }
        log.info("Received OrderCreatedEvent for orderId={}", event.orderId());
        try {
            paymentService.processPayment(event.orderId(), event.amount(), event.eventCreatedAt());
            log.info("Payment processed for orderId={}", event.orderId());
        } catch (DuplicatePaymentException e) {
            log.info("Duplicate OrderCreatedEvent ignored for orderId={}", event.orderId());
        }
        // any other exception (e.g. database down) goes to the container error handler: retry, then log+skip
    }
}
