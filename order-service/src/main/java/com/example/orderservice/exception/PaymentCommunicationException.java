package com.example.orderservice.exception;

public class PaymentCommunicationException extends RuntimeException {
    public PaymentCommunicationException(String message, Throwable cause) {
        super(message, cause);
    }
}
