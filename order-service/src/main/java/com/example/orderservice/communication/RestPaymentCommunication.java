package com.example.orderservice.communication;

import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.exception.PaymentCommunicationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** REST experiment: synchronous HTTP call to the Payment Service. */
@Component
@ConditionalOnProperty(prefix = "communication", name = "mode", havingValue = "REST", matchIfMissing = true)
public class RestPaymentCommunication implements PaymentCommunication {

    private static final Logger log = LoggerFactory.getLogger(RestPaymentCommunication.class);

    private final RestClient paymentRestClient;

    public RestPaymentCommunication(RestClient paymentRestClient) {
        this.paymentRestClient = paymentRestClient;
    }

    @Override
    public void sendPayment(OrderCreatedEvent event) {
        log.info("Sending payment request for orderId={}", event.orderId());
        try {
            paymentRestClient.post()
                    .uri("/api/payments")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new PaymentRequest(event.orderId(), event.amount(), event.eventCreatedAt()))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            throw new PaymentCommunicationException(
                    "REST call to Payment Service failed for orderId=" + event.orderId(), e);
        }
    }
}
