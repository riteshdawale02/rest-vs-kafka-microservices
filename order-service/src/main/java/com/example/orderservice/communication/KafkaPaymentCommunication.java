package com.example.orderservice.communication;

import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.kafka.OrderEventProducer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Kafka experiment: publish the event; the Payment Service consumes it asynchronously. */
@Component
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "KAFKA")
public class KafkaPaymentCommunication implements PaymentCommunication {

    private final OrderEventProducer producer;

    public KafkaPaymentCommunication(OrderEventProducer producer) {
        this.producer = producer;
    }

    @Override
    public void sendPayment(OrderCreatedEvent event) {
        producer.publish(event);
    }
}
