package com.example.paymentservice;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.util.concurrent.atomic.AtomicLong;
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
class PaymentControllerIntegrationTest {

    // orderId is unique per payment, so every test uses a fresh one
    private static final AtomicLong ORDER_IDS = new AtomicLong(1000);

    @Autowired
    private MockMvc mvc;

    private String body(long orderId) {
        return "{\"orderId\":" + orderId + ",\"amount\":1500.00}";
    }

    private int createPayment(long orderId) throws Exception {
        String response = mvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON).content(body(orderId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    @Test
    void createPayment_returns201WithSuccessStatus() throws Exception {
        long orderId = ORDER_IDS.incrementAndGet();
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body(orderId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.amount").value(1500.00))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    void createPayment_duplicateOrder_returns409() throws Exception {
        long orderId = ORDER_IDS.incrementAndGet();
        createPayment(orderId);
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body(orderId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void getPayment_returnsExistingPayment() throws Exception {
        long orderId = ORDER_IDS.incrementAndGet();
        int id = createPayment(orderId);
        mvc.perform(get("/api/payments/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.orderId").value(orderId));
    }

    @Test
    void getPaymentByOrder_returnsExistingPayment() throws Exception {
        long orderId = ORDER_IDS.incrementAndGet();
        int id = createPayment(orderId);
        mvc.perform(get("/api/payments/order/" + orderId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void updateStatus_changesStatus() throws Exception {
        int id = createPayment(ORDER_IDS.incrementAndGet());
        mvc.perform(patch("/api/payments/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"FAILED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"));
        mvc.perform(get("/api/payments/" + id))
                .andExpect(jsonPath("$.status").value("FAILED"));
    }

    @Test
    void getPayment_whenMissing_returns404() throws Exception {
        mvc.perform(get("/api/payments/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Payment not found"))
                .andExpect(jsonPath("$.path").value("/api/payments/999999"));
    }

    @Test
    void getPaymentByOrder_whenMissing_returns404() throws Exception {
        mvc.perform(get("/api/payments/order/999999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateStatus_whenMissing_returns404() throws Exception {
        mvc.perform(patch("/api/payments/999999/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"SUCCESS\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createPayment_withInvalidAmount_returns400() throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":1,\"amount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.path").value("/api/payments"));
    }

    @Test
    void createPayment_withInvalidOrderId_returns400() throws Exception {
        mvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":-5,\"amount\":100.00}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateStatus_withInvalidStatus_returns400() throws Exception {
        int id = createPayment(ORDER_IDS.incrementAndGet());
        mvc.perform(patch("/api/payments/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void prometheusEndpoint_isExposed() throws Exception {
        mvc.perform(get("/actuator/prometheus")).andExpect(status().isOk());
    }
}
