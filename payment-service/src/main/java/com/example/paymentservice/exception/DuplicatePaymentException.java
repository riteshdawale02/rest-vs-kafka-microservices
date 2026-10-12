package com.example.paymentservice.exception;

/** A payment already exists for this orderId (idempotency guard). */
public class DuplicatePaymentException extends RuntimeException {
    public DuplicatePaymentException(Long orderId) {
        super("Payment already exists for this order");
    }
}
