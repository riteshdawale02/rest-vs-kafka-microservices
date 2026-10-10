package com.example.orderservice.communication;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "REST", matchIfMissing = true)
public class PaymentRestClientConfig {

    @Bean
    public RestClient paymentRestClient(RestClient.Builder builder,
                                        @Value("${payment.service.url}") String baseUrl,
                                        @Value("${payment.service.connect-timeout-ms:2000}") long connectTimeoutMs,
                                        @Value("${payment.service.read-timeout-ms:5000}") long readTimeoutMs) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        return builder.baseUrl(baseUrl).requestFactory(factory).build();
    }
}
