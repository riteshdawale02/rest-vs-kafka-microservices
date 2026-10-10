package com.example.orderservice.kafka;

import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.exception.PaymentCommunicationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Only job: publish OrderCreatedEvent (key = orderId) and wait for the broker's acknowledgment.
 * No business logic.
 */
@Component
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "KAFKA")
public class OrderEventProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventProducer.class);
    private static final long ACK_TIMEOUT_SECONDS = 15; // > delivery.timeout.ms (10s)

    private final KafkaTemplate<Long, OrderCreatedEvent> kafkaTemplate;
    private final String topic;

    public OrderEventProducer(KafkaTemplate<Long, OrderCreatedEvent> kafkaTemplate,
                              @Value("${kafka.topic.orders:orders}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void publish(OrderCreatedEvent event) {
        log.info("Publishing OrderCreatedEvent for orderId={}", event.orderId());
        try {
            kafkaTemplate.send(topic, event.orderId(), event).get(ACK_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new PaymentCommunicationException("Interrupted while publishing orderId=" + event.orderId(), e);
        } catch (ExecutionException | TimeoutException e) {
            throw new PaymentCommunicationException("Kafka publish failed for orderId=" + event.orderId(), e);
        }
    }
}
