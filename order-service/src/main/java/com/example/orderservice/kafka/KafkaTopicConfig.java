package com.example.orderservice.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * Creates the topic if it does not exist (convenient for local runs).
 * With Docker Compose the kafka-init container creates it first with the same settings.
 */
@Configuration
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "KAFKA")
public class KafkaTopicConfig {

    @Bean
    public NewTopic ordersTopic(@Value("${kafka.topic.orders:orders}") String name,
                                @Value("${kafka.topic.partitions:3}") int partitions) {
        return TopicBuilder.name(name).partitions(partitions).replicas(1).build();
    }
}
