package com.example.orderservice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.LongDeserializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * KAFKA mode end to end on the Order Service side: POST /api/orders puts a JSON event on the
 * "orders" topic, keyed by orderId. No Payment Service and no REST client exist in this mode.
 */
@SpringBootTest(properties = {"communication.mode=KAFKA", "kafka.topic.partitions=1"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, topics = {"orders"}, bootstrapServersProperty = "spring.kafka.bootstrap-servers")
class KafkaModeIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private EmbeddedKafkaBroker broker;

    @Test
    void createOrder_publishesEventKeyedByOrderId() throws Exception {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, broker.getBrokersAsString());
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "verify-" + UUID.randomUUID());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        try (KafkaConsumer<Long, String> consumer =
                     new KafkaConsumer<>(props, new LongDeserializer(), new StringDeserializer())) {
            consumer.subscribe(List.of("orders"));

            String response = mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"customerId\":101,\"productId\":501,\"quantity\":2,\"amount\":1500.00}"))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            int orderId = JsonPath.read(response, "$.id");

            ConsumerRecord<Long, String> record = null;
            long deadline = System.currentTimeMillis() + 15_000;
            while (record == null && System.currentTimeMillis() < deadline) {
                ConsumerRecords<Long, String> records = consumer.poll(Duration.ofMillis(500));
                if (!records.isEmpty()) {
                    record = records.iterator().next();
                }
            }

            assertNotNull(record, "no message received on topic 'orders'");
            assertEquals((long) orderId, record.key());
            assertEquals(orderId, (int) JsonPath.read(record.value(), "$.orderId"));
            assertEquals(101, (int) JsonPath.read(record.value(), "$.customerId"));
            assertNotNull(JsonPath.read(record.value(), "$.eventCreatedAt"));
        }
    }
}
