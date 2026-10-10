package com.example.orderservice.controller;

import com.example.orderservice.dto.CreateOrderRequest;
import com.example.orderservice.dto.OrderResponse;
import com.example.orderservice.dto.UpdateOrderStatusRequest;
import com.example.orderservice.service.OrderService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> create(@Valid @RequestBody CreateOrderRequest request) {
        OrderResponse created = orderService.createOrder(request);
        return ResponseEntity.created(URI.create("/api/orders/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return orderService.getOrder(id);
    }

    @GetMapping
    public List<OrderResponse> getAll() {
        return orderService.getAllOrders();
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable Long id,
                                      @Valid @RequestBody UpdateOrderStatusRequest request) {
        return orderService.updateStatus(id, request);
    }
}
