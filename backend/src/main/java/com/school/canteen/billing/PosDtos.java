package com.school.canteen.billing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request/response shapes for the billing API. */
public final class PosDtos {

    private PosDtos() {
    }

    // ---- catalog -------------------------------------------------------------------------

    public record CategoryRequest(
            @NotBlank @Size(max = 80) String name,
            @Min(0) @Max(100000) Integer sortOrder) {
    }

    public record ItemRequest(
            @NotNull UUID categoryId,
            @NotBlank @Size(max = 120) String name,
            @NotNull @DecimalMin("0.00") @DecimalMax("9999999.99") @Digits(integer = 7, fraction = 2) BigDecimal price,
            @Size(max = 16) String emoji,
            Boolean available,
            Boolean favorite,
            @Min(0) @Max(100000) Integer sortOrder) {
    }

    public record AvailabilityRequest(@NotNull Boolean available) {
    }

    public record CategoryResponse(UUID id, String name, int sortOrder) {
    }

    public record ItemResponse(UUID id, UUID categoryId, String name, BigDecimal price, String emoji,
                               boolean available, boolean favorite, int sortOrder) {
    }

    public record CatalogResponse(List<CategoryResponse> categories, List<ItemResponse> items) {
    }

    // ---- settings ------------------------------------------------------------------------

    public record SettingsRequest(
            @NotBlank @Size(max = 120) String businessName,
            @NotNull @Size(max = 255) String address,
            @NotNull @Size(max = 30) String phone,
            @NotNull @Size(max = 20) String gstin,
            @NotNull @Size(max = 160) String footerMessage,
            @NotBlank @Size(max = 4) String currencySymbol,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") @Digits(integer = 3, fraction = 2) BigDecimal gstPercent,
            @NotNull Boolean gstEnabledDefault) {
    }

    public record SettingsResponse(String businessName, String address, String phone, String gstin,
                                   String footerMessage, String currencySymbol, BigDecimal gstPercent,
                                   boolean gstEnabledDefault) {
    }

    // ---- bills ---------------------------------------------------------------------------

    public record LineRequest(
            @NotNull UUID itemId,
            @Min(1) @Max(999) int quantity) {
    }

    public record CreateBillRequest(
            @NotBlank @Size(max = 80) String idempotencyKey,
            @NotEmpty @Size(max = 100) List<@Valid LineRequest> lines,
            boolean gstEnabled,
            PosBill.PaymentMethod paymentMethod) {
    }

    public record VoidRequest(@NotBlank @Size(max = 255) String reason) {
    }

    public record BillLineResponse(UUID itemId, String itemName, String emoji, BigDecimal unitPrice,
                                   int quantity, BigDecimal lineTotal) {
    }

    /** Full bill = the receipt. Reprinting is just reading this again; it creates nothing. */
    public record BillResponse(UUID id, String invoiceNumber, LocalDate billDate, Instant createdAt,
                               UUID createdBy, String createdByName, PosBill.Status status,
                               String voidReason, Instant voidedAt, PosBill.PaymentMethod paymentMethod,
                               /** Always MANUAL_UNVERIFIED: no gateway confirms POS payments. */
                               String paymentStatus,
                               BigDecimal subtotal, BigDecimal gstPercent, BigDecimal gstAmount,
                               BigDecimal total, String businessName, String address, String phone,
                               String gstin, String footerMessage, String currencySymbol,
                               List<BillLineResponse> lines) {
    }

    public record BillSummary(UUID id, String invoiceNumber, LocalDate billDate, Instant createdAt,
                              String createdByName, PosBill.Status status, PosBill.PaymentMethod paymentMethod,
                              BigDecimal total, int itemCount) {
    }

    public record BillPage(List<BillSummary> content, long totalElements, int page, int size) {
    }

    // ---- held carts ----------------------------------------------------------------------

    public record HeldLine(@NotNull UUID itemId, @Min(1) @Max(999) int quantity) {
    }

    public record HoldRequest(
            @Size(max = 80) String label,
            @NotEmpty @Size(max = 100) List<@Valid HeldLine> lines) {
    }

    public record HeldCartResponse(UUID id, String label, Instant createdAt, List<HeldLine> lines) {
    }

    // ---- reports -------------------------------------------------------------------------

    public enum Granularity { DAY, WEEK, MONTH }

    public record PeriodRow(LocalDate periodStart, long bills, BigDecimal subtotal, BigDecimal gst,
                            BigDecimal total) {
    }

    public record PaymentRow(String method, long bills, BigDecimal total) {
    }

    public record ItemRow(String itemName, long quantity, BigDecimal total) {
    }

    /** Completed bills only; voided bills are listed separately and never counted in totals. */
    public record SalesSummary(LocalDate from, LocalDate to, Granularity granularity,
                               long bills, BigDecimal subtotal, BigDecimal gst, BigDecimal total,
                               long voidedBills, BigDecimal voidedTotal,
                               List<PeriodRow> periods, List<PaymentRow> byPayment, List<ItemRow> byItem) {
    }
}
