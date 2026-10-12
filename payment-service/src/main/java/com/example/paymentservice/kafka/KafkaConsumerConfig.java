package com.example.paymentservice.kafka;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "KAFKA")
public class KafkaConsumerConfig {

    /**
     * Failed record: retry (default 3 times, 1 s apart), then log the failure and move on, so one
     * bad message can never block the partition or crash the application. Undeserializable
     * messages (bad JSON) are not retried at all. No dead-letter topic: this prototype keeps the
     * pipeline minimal, and the ERROR log names the skipped record.
     */
    @Bean
    public DefaultErrorHandler kafkaErrorHandler(
            @Value("${kafka.consumer.retry.interval-ms:1000}") long intervalMs,
            @Value("${kafka.consumer.retry.max-attempts:3}") long maxAttempts) {
        return new DefaultErrorHandler(new FixedBackOff(intervalMs, maxAttempts));
    }
}
