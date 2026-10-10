package com.example.orderservice;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import com.example.orderservice.communication.RestPaymentCommunication;
import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.exception.PaymentCommunicationException;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** The REST baseline: verifies the exact HTTP call made to the Payment Service. */
class RestPaymentCommunicationTest {

    private final OrderCreatedEvent event =
            new OrderCreatedEvent(10L, 101L, 501L, 2, new BigDecimal("1500.00"), Instant.now());

    @Test
    void sendPayment_postsToPaymentService() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://payment-service:8081");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://payment-service:8081/api/payments"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.orderId").value(10))
                .andRespond(withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON).body("{}"));

        new RestPaymentCommunication(builder.build()).sendPayment(event);

        server.verify();
    }

    @Test
    void sendPayment_wrapsServerError() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://payment-service:8081");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://payment-service:8081/api/payments"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        RestPaymentCommunication communication = new RestPaymentCommunication(builder.build());

        assertThrows(PaymentCommunicationException.class, () -> communication.sendPayment(event));
    }
}
