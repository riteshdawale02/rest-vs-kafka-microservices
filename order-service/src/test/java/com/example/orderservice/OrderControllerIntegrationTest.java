package com.example.orderservice;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import com.example.orderservice.communication.PaymentCommunication;
import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.exception.PaymentCommunicationException;
import com.jayway.jsonpath.JsonPath;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderControllerIntegrationTest {

    private static final String VALID_ORDER =
            "{\"customerId\":101,\"productId\":501,\"quantity\":2,\"amount\":1500.00}";

    @Autowired
    private MockMvc mvc;

    // The Payment Service is not running in unit/integration tests.
    @MockBean
    private PaymentCommunication paymentCommunication;

    private int createOrder() throws Exception {
        String body = mvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_ORDER))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void createOrder_returns201WithPendingStatus() throws Exception {
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(VALID_ORDER))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.customerId").value(101))
                .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    void createOrder_withInvalidInput_returns400() throws Exception {
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":-1,\"productId\":501,\"quantity\":0,\"amount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.path").value("/api/orders"));
    }

    @Test
    void getOrder_returnsExistingOrder() throws Exception {
        int id = createOrder();
        mvc.perform(get("/api/orders/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.productId").value(501));
    }

    @Test
    void getAllOrders_returnsList() throws Exception {
        createOrder();
        mvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getOrder_whenMissing_returns404() throws Exception {
        mvc.perform(get("/api/orders/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Order not found"))
                .andExpect(jsonPath("$.path").value("/api/orders/999999"));
    }

    @Test
    void updateStatus_changesStatus() throws Exception {
        int id = createOrder();
        mvc.perform(patch("/api/orders/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PAID\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"));
        mvc.perform(get("/api/orders/" + id))
                .andExpect(jsonPath("$.status").value("PAID"));
    }

    @Test
    void updateStatus_withInvalidValue_returns400() throws Exception {
        int id = createOrder();
        mvc.perform(patch("/api/orders/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateStatus_whenMissing_returns404() throws Exception {
        mvc.perform(patch("/api/orders/999999/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PAID\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void prometheusEndpoint_isExposed() throws Exception {
        mvc.perform(get("/actuator/prometheus")).andExpect(status().isOk());
    }

    @Test
    void createOrder_sendsPaymentEventOnce() throws Exception {
        int id = createOrder();
        ArgumentCaptor<OrderCreatedEvent> captor = ArgumentCaptor.forClass(OrderCreatedEvent.class);
        verify(paymentCommunication).sendPayment(captor.capture());
        OrderCreatedEvent event = captor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals((long) id, event.orderId());
        org.junit.jupiter.api.Assertions.assertEquals(101L, event.customerId());
        org.junit.jupiter.api.Assertions.assertNotNull(event.eventCreatedAt());
    }

    @Test
    void createOrder_whenPaymentCommunicationFails_returns503() throws Exception {
        doThrow(new PaymentCommunicationException("down", null))
                .when(paymentCommunication).sendPayment(any());
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(VALID_ORDER))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }
}
