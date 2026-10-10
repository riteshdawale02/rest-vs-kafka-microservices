package com.example.orderservice.service;

import com.example.orderservice.communication.PaymentCommunication;
import com.example.orderservice.dto.CreateOrderRequest;
import com.example.orderservice.dto.OrderResponse;
import com.example.orderservice.dto.UpdateOrderStatusRequest;
import com.example.orderservice.entity.Order;
import com.example.orderservice.event.OrderCreatedEvent;
import com.example.orderservice.exception.OrderNotFoundException;
import com.example.orderservice.repository.OrderRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository repository;
    private final PaymentCommunication paymentCommunication;

    public OrderService(OrderRepository repository, PaymentCommunication paymentCommunication) {
        this.repository = repository;
        this.paymentCommunication = paymentCommunication;
    }

    /**
     * Deliberately NOT @Transactional: repository.save() commits the order first, so no DB
     * connection is held while waiting on the Payment Service (REST) or the broker (Kafka).
     * This keeps the database behaviour identical in both experiment modes.
     * If communication fails, the order stays PENDING and the caller gets 503.
     */
    public OrderResponse createOrder(CreateOrderRequest req) {
        Order saved = repository.save(
                new Order(req.customerId(), req.productId(), req.quantity(), req.amount()));
        paymentCommunication.sendPayment(OrderCreatedEvent.from(saved));
        return OrderResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long id) {
        return repository.findById(id)
                .map(OrderResponse::from)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders() {
        return repository.findAll().stream().map(OrderResponse::from).toList();
    }

    @Transactional
    public OrderResponse updateStatus(Long id, UpdateOrderStatusRequest req) {
        Order order = repository.findById(id).orElseThrow(() -> new OrderNotFoundException(id));
        order.setStatus(req.status()); // persisted by JPA dirty checking on commit
        return OrderResponse.from(order);
    }
}
