package com.example.paymentservice;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.PaymentStatus;
import com.example.paymentservice.repository.PaymentRepository;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.LongSerializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;

/**
 * Kafka -> OrderEventConsumer -> PaymentService -> database, using an embedded broker.
 * Messages are raw JSON strings, so this also pins the wire format the Order Service must produce.
 */
@SpringBootTest(properties = "communication.mode=KAFKA")
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, topics = {"orders"}, bootstrapServersProperty = "spring.kafka.bootstrap-servers")
class KafkaConsumerIntegrationTest {

    @Autowired
    private EmbeddedKafkaBroker broker;

    @Autowired
    private PaymentRepository repository;

    private static String json(long orderId) {
        return "{\"orderId\":" + orderId + ",\"customerId\":101,\"productId\":501,\"quantity\":2,"
                + "\"amount\":1500.00,\"eventCreatedAt\":\"2026-10-01T10:30:00.123456Z\"}";
    }

    private void send(long key, String value) throws Exception {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, broker.getBrokersAsString());
        try (KafkaProducer<Long, String> producer =
                     new KafkaProducer<>(props, new LongSerializer(), new StringSerializer())) {
            producer.send(new ProducerRecord<>("orders", key, value)).get();
        }
    }

    private void awaitPayment(long orderId) {
        await().atMost(Duration.ofSeconds(20))
                .untilAsserted(() -> assertEquals(true, repository.findByOrderId(orderId).isPresent()));
    }

    private long countFor(long orderId) {
        return repository.findAll().stream().filter(p -> p.getOrderId().equals(orderId)).count();
    }

    @Test
    void event_createsSuccessfulPayment() throws Exception {
        send(7001L, json(7001L));
        awaitPayment(7001L);

        Payment p = repository.findByOrderId(7001L).orElseThrow();
        assertEquals(PaymentStatus.SUCCESS, p.getStatus());
        assertNotNull(p.getEventCreatedAt());
        assertNotNull(p.getProcessedAt());
    }

    @Test
    void duplicateEvent_createsOnlyOnePayment() throws Exception {
        send(7002L, json(7002L));
        send(7002L, json(7002L)); // duplicate delivery
        send(7003L, json(7003L)); // sentinel: same single partition, so processed after the duplicate
        awaitPayment(7003L);

        assertEquals(1, countFor(7002L));
    }

    @Test
    void malformedMessage_doesNotStopTheConsumer() throws Exception {
        send(7004L, "this is not json");
        send(7005L, json(7005L));
        awaitPayment(7005L);

        assertEquals(1, countFor(7005L));
    }
}
