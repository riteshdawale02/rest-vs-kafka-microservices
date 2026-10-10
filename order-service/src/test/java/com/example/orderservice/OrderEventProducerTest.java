package com.example.orderservice;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.exception.PaymentCommunicationException;
import com.example.orderservice.kafka.OrderEventProducer;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

@ExtendWith(MockitoExtension.class)
class OrderEventProducerTest {

    @Mock
    private KafkaTemplate<Long, OrderCreatedEvent> kafkaTemplate;

    private final OrderCreatedEvent event =
            new OrderCreatedEvent(10L, 101L, 501L, 2, new BigDecimal("1500.00"), Instant.now());

    @Test
    void publish_sendsToOrdersTopicWithOrderIdAsKey() {
        when(kafkaTemplate.send("orders", 10L, event))
                .thenReturn(CompletableFuture.<SendResult<Long, OrderCreatedEvent>>completedFuture(null));

        new OrderEventProducer(kafkaTemplate, "orders").publish(event);

        verify(kafkaTemplate).send("orders", 10L, event);
    }

    @Test
    void publish_wrapsBrokerFailure() {
        when(kafkaTemplate.send("orders", 10L, event))
                .thenReturn(CompletableFuture.<SendResult<Long, OrderCreatedEvent>>failedFuture(
                        new RuntimeException("broker down")));

        OrderEventProducer producer = new OrderEventProducer(kafkaTemplate, "orders");

        assertThrows(PaymentCommunicationException.class, () -> producer.publish(event));
    }
}
