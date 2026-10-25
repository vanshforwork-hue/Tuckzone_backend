package com.school.canteen.billing;

import com.school.canteen.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * An issued bill. Amounts, tax rate and receipt header are frozen at issue time; the only
 * mutation ever allowed is COMPLETED -> VOID (see {@link #voidBill}).
 */
@Entity
@Table(name = "pos_bills")
public class PosBill extends BaseEntity {

    public enum Status { COMPLETED, VOID }

    /** Recorded by the cashier by hand; no gateway ever verifies it. */
    public enum PaymentMethod { CASH, UPI, CARD, OTHER }

    @Column(name = "invoice_number", nullable = false, updatable = false)
    private String invoiceNumber;

    @Column(name = "bill_date", nullable = false, updatable = false)
    private LocalDate billDate;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "idempotency_key", nullable = false, updatable = false)
    private String idempotencyKey;

    @Column(name = "subtotal", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "gst_percent", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal gstPercent;

    @Column(name = "gst_amount", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal gstAmount;

    @Column(name = "total", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", updatable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.COMPLETED;

    @Column(name = "void_reason")
    private String voidReason;

    @Column(name = "voided_by")
    private UUID voidedBy;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @Column(name = "business_name", nullable = false, updatable = false)
    private String businessName;

    @Column(name = "address", nullable = false, updatable = false)
    private String address;

    @Column(name = "phone", nullable = false, updatable = false)
    private String phone;

    @Column(name = "gstin", nullable = false, updatable = false)
    private String gstin;

    @Column(name = "footer_message", nullable = false, updatable = false)
    private String footerMessage;

    @Column(name = "currency_symbol", nullable = false, updatable = false)
    private String currencySymbol;

    protected PosBill() {
    }

    public PosBill(String invoiceNumber, LocalDate billDate, UUID createdBy, String idempotencyKey,
                   BigDecimal subtotal, BigDecimal gstPercent, BigDecimal gstAmount, BigDecimal total,
                   PaymentMethod paymentMethod, PosSettings header) {
        this.invoiceNumber = invoiceNumber;
        this.billDate = billDate;
        this.createdBy = createdBy;
        this.idempotencyKey = idempotencyKey;
        this.subtotal = subtotal;
        this.gstPercent = gstPercent;
        this.gstAmount = gstAmount;
        this.total = total;
        this.paymentMethod = paymentMethod;
        this.businessName = header.getBusinessName();
        this.address = header.getAddress();
        this.phone = header.getPhone();
        this.gstin = header.getGstin();
        this.footerMessage = header.getFooterMessage();
        this.currencySymbol = header.getCurrencySymbol();
    }

    public void voidBill(UUID by, String reason, Instant at) {
        this.status = Status.VOID;
        this.voidReason = reason;
        this.voidedBy = by;
        this.voidedAt = at;
    }

    public String getInvoiceNumber() { return invoiceNumber; }
    public LocalDate getBillDate() { return billDate; }
    public UUID getCreatedBy() { return createdBy; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getGstPercent() { return gstPercent; }
    public BigDecimal getGstAmount() { return gstAmount; }
    public BigDecimal getTotal() { return total; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public Status getStatus() { return status; }
    public String getVoidReason() { return voidReason; }
    public UUID getVoidedBy() { return voidedBy; }
    public Instant getVoidedAt() { return voidedAt; }
    public String getBusinessName() { return businessName; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }
    public String getGstin() { return gstin; }
    public String getFooterMessage() { return footerMessage; }
    public String getCurrencySymbol() { return currencySymbol; }
}
