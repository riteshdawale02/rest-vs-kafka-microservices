package com.example.paymentservice.service;

import com.example.paymentservice.dto.PaymentResponse;
import com.example.paymentservice.dto.UpdatePaymentStatusRequest;
import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.PaymentStatus;
import com.example.paymentservice.exception.DuplicatePaymentException;
import com.example.paymentservice.exception.PaymentNotFoundException;
import com.example.paymentservice.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentService {

    private final PaymentRepository repository;

    public PaymentService(PaymentRepository repository) {
        this.repository = repository;
    }

    /**
     * THE single payment-processing entry point, used by BOTH the REST controller and the
     * Kafka consumer, so both experiments run identical business logic.
     *
     * Idempotent per orderId: if a payment already exists, nothing is written and
     * DuplicatePaymentException is thrown (REST -> 409, Kafka consumer -> logged and ignored).
     * The unique index on order_id guards the race where two duplicates pass the check together.
     *
     * Cost: 1 SELECT (existence check) + 1 INSERT. Processing is simulated: always SUCCESS.
     *
     * @param eventCreatedAt when the Order Service created the event; may be null
     */
    @Transactional
    public PaymentResponse processPayment(Long orderId, BigDecimal amount, Instant eventCreatedAt) {
        if (repository.existsByOrderId(orderId)) {
            throw new DuplicatePaymentException(orderId);
        }
        Payment payment = new Payment(orderId, amount, PaymentStatus.SUCCESS, eventCreatedAt);
        try {
            return PaymentResponse.from(repository.save(payment));
        } catch (DataIntegrityViolationException e) {
            throw new DuplicatePaymentException(orderId);
        }
    }

    /** Convenience overload without timing information. */
    @Transactional
    public PaymentResponse processPayment(Long orderId, BigDecimal amount) {
        return processPayment(orderId, amount, null);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPayment(Long id) {
        return repository.findById(id)
                .map(PaymentResponse::from)
                .orElseThrow(PaymentNotFoundException::new);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByOrderId(Long orderId) {
        return repository.findByOrderId(orderId)
                .map(PaymentResponse::from)
                .orElseThrow(PaymentNotFoundException::new);
    }

    @Transactional
    public PaymentResponse updateStatus(Long id, UpdatePaymentStatusRequest request) {
        Payment payment = repository.findById(id).orElseThrow(PaymentNotFoundException::new);
        payment.setStatus(request.status()); // persisted by JPA dirty checking on commit
        return PaymentResponse.from(payment);
    }
}
