package com.example.paymentservice.controller;

import com.example.paymentservice.dto.CreatePaymentRequest;
import com.example.paymentservice.dto.PaymentResponse;
import com.example.paymentservice.dto.UpdatePaymentStatusRequest;
import com.example.paymentservice.service.PaymentService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    public ResponseEntity<PaymentResponse> create(@Valid @RequestBody CreatePaymentRequest request) {
        PaymentResponse created = paymentService.processPayment(request.orderId(), request.amount(), request.eventCreatedAt());
        return ResponseEntity.created(URI.create("/api/payments/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public PaymentResponse get(@PathVariable Long id) {
        return paymentService.getPayment(id);
    }

    @GetMapping("/order/{orderId}")
    public PaymentResponse getByOrder(@PathVariable Long orderId) {
        return paymentService.getPaymentByOrderId(orderId);
    }

    @PatchMapping("/{id}/status")
    public PaymentResponse updateStatus(@PathVariable Long id,
                                        @Valid @RequestBody UpdatePaymentStatusRequest request) {
        return paymentService.updateStatus(id, request);
    }
}
