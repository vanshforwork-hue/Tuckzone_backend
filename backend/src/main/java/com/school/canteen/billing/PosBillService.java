package com.school.canteen.billing;

import com.school.canteen.billing.PosDtos.BillLineResponse;
import com.school.canteen.billing.PosDtos.BillPage;
import com.school.canteen.billing.PosDtos.BillResponse;
import com.school.canteen.billing.PosDtos.BillSummary;
import com.school.canteen.billing.PosDtos.CreateBillRequest;
import com.school.canteen.billing.PosDtos.HeldCartResponse;
import com.school.canteen.billing.PosDtos.HeldLine;
import com.school.canteen.billing.PosDtos.HoldRequest;
import com.school.canteen.entity.User;
import com.school.canteen.exception.BadRequestException;
import com.school.canteen.exception.DuplicateResourceException;
import com.school.canteen.exception.ResourceNotFoundException;
import com.school.canteen.repository.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Bill creation, history, voiding and held carts.
 *
 * Scope rule: a {@link PosActor} that is not an admin only ever sees/touches bills and held
 * carts it created; out-of-scope ids answer 404 so their existence is not revealed.
 */
@Service
public class PosBillService {

    static final int GST_SCALE = 2;
    private static final int MAX_RANGE_DAYS = 366;
    private static final TypeReference<List<HeldLine>> HELD_LINES = new TypeReference<>() { };

    private final PosBillRepository bills;
    private final PosBillItemRepository billItems;
    private final PosItemRepository items;
    private final PosHeldCartRepository heldCarts;
    private final PosCatalogService catalog;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final ObjectMapper json;

    public PosBillService(PosBillRepository bills, PosBillItemRepository billItems,
                          PosItemRepository items, PosHeldCartRepository heldCarts,
                          PosCatalogService catalog, UserRepository users, JdbcTemplate jdbc,
                          PlatformTransactionManager txManager, Clock clock, ObjectMapper json) {
        this.bills = bills;
        this.billItems = billItems;
        this.items = items;
        this.heldCarts = heldCarts;
        this.catalog = catalog;
        this.users = users;
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(txManager);
        this.clock = clock;
        this.json = json;
    }

    // ---- create --------------------------------------------------------------------------

    /**
     * Idempotent per (actor, idempotencyKey): a retry or double-tap returns the first bill
     * instead of creating a second sale. A concurrent duplicate loses on the unique
     * constraint and is resolved by re-reading the winner.
     */
    public BillResponse create(PosActor actor, CreateBillRequest req) {
        var existing = bills.findByCreatedByAndIdempotencyKey(actor.id(), req.idempotencyKey());
        if (existing.isPresent()) {
            return tx.execute(s -> toResponse(existing.get()));
        }
        try {
            return tx.execute(s -> doCreate(actor, req));
        } catch (DataIntegrityViolationException e) {
            return bills.findByCreatedByAndIdempotencyKey(actor.id(), req.idempotencyKey())
                    .map(b -> tx.execute(s -> toResponse(b)))
                    .orElseThrow(() -> e);
        }
    }

    private BillResponse doCreate(PosActor actor, CreateBillRequest req) {
        Map<UUID, Integer> qty = mergeLines(req.lines().stream()
                .map(l -> new HeldLine(l.itemId(), l.quantity())).toList());
        Map<UUID, PosItem> byId = items.lockAllById(qty.keySet()).stream()
                .collect(Collectors.toMap(PosItem::getId, i -> i));

        List<PosItem> ordered = new ArrayList<>();
        for (UUID id : qty.keySet()) {
            PosItem item = byId.get(id);
            if (item == null || !item.isActive()) {
                throw new BadRequestException("An item in this bill is no longer on the menu.");
            }
            if (!item.isAvailable()) {
                throw new BadRequestException("'" + item.getName() + "' is currently unavailable.");
            }
            ordered.add(item);
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (PosItem item : ordered) {
            subtotal = subtotal.add(item.getPrice().multiply(BigDecimal.valueOf(qty.get(item.getId()))));
        }
        if (subtotal.signum() <= 0) {
            throw new BadRequestException("Bill total must be greater than zero.");
        }

        PosSettings header = catalog.settingsRow();
        BigDecimal pct = req.gstEnabled() ? header.getGstPercent() : BigDecimal.ZERO.setScale(2);
        BigDecimal gst = computeGst(subtotal, pct);
        BigDecimal total = subtotal.add(gst);

        LocalDate today = LocalDate.now(clock);
        PosBill bill = bills.saveAndFlush(new PosBill(nextInvoiceNumber(today), today, actor.id(),
                req.idempotencyKey(), subtotal, pct, gst, total, req.paymentMethod(), header));
        List<PosBillItem> lines = ordered.stream()
                .map(i -> new PosBillItem(bill.getId(), i, qty.get(i.getId()))).toList();
        billItems.saveAll(lines);
        return toResponse(bill, lines, Map.of(actor.id(), nameOf(actor.id())));
    }

    /** Exclusive GST, rounded half-up to the paisa. */
    static BigDecimal computeGst(BigDecimal subtotal, BigDecimal percent) {
        return subtotal.multiply(percent).divide(BigDecimal.valueOf(100), GST_SCALE, RoundingMode.HALF_UP);
    }

    /** Atomic per-day counter: the upsert row-locks, so concurrent checkouts get distinct numbers. */
    private String nextInvoiceNumber(LocalDate date) {
        Integer n = jdbc.queryForObject("""
                insert into pos_bill_counters (bill_date, last_number) values (?, 1)
                on conflict (bill_date) do update set last_number = pos_bill_counters.last_number + 1
                returning last_number
                """, Integer.class, java.sql.Date.valueOf(date));
        return "INV-%s-%04d".formatted(date.toString().replace("-", ""), n);
    }

    // ---- read ----------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public BillResponse get(PosActor actor, UUID id) {
        return toResponse(scoped(actor, id));
    }

    @Transactional(readOnly = true)
    public BillPage search(PosActor actor, LocalDate from, LocalDate to, PosBill.Status status,
                           String q, Integer page, Integer size) {
        LocalDate today = LocalDate.now(clock);
        LocalDate f = from == null ? today : from;
        LocalDate t = to == null ? f : to;
        checkRange(f, t);
        String term = q == null ? "" : q.trim();
        int p = page == null || page < 0 ? 0 : page;
        int sz = size == null || size < 1 ? 50 : Math.min(size, 200);

        Page<PosBill> result = bills.search(f, t, actor.admin() ? null : actor.id(), status, term, PageRequest.of(p, sz));
        List<UUID> ids = result.getContent().stream().map(PosBill::getId).toList();
        Map<UUID, Integer> counts = new HashMap<>();
        if (!ids.isEmpty()) {
            billItems.findByBillIdInOrderByCreatedAtAsc(ids).forEach(i -> counts.merge(i.getBillId(), i.getQuantity(), Integer::sum));
        }
        Map<UUID, String> names = names(result.getContent().stream().map(PosBill::getCreatedBy).toList());
        List<BillSummary> rows = result.getContent().stream().map(b -> new BillSummary(b.getId(),
                b.getInvoiceNumber(), b.getBillDate(), b.getCreatedAt(), names.getOrDefault(b.getCreatedBy(), ""),
                b.getStatus(), b.getPaymentMethod(), b.getTotal(), counts.getOrDefault(b.getId(), 0))).toList();
        return new BillPage(rows, result.getTotalElements(), p, sz);
    }

    // ---- void ----------------------------------------------------------------------------

    /**
     * COMPLETED -> VOID, admin only (enforced on the controller). The bill, its lines and its
     * invoice number stay on file; reports exclude it from sales. There is no refund flow in
     * the reference app, so none is invented here.
     */
    @Transactional
    public BillResponse voidBill(PosActor admin, UUID id, String reason) {
        PosBill bill = bills.findById(id).orElseThrow(() -> new ResourceNotFoundException("Bill not found."));
        if (bill.getStatus() == PosBill.Status.VOID) {
            throw new DuplicateResourceException("This bill is already void.");
        }
        bill.voidBill(admin.id(), reason.trim(), Instant.now(clock));
        return toResponse(bill);
    }

    // ---- held carts ----------------------------------------------------------------------

    @Transactional
    public HeldCartResponse hold(PosActor actor, HoldRequest req) {
        Map<UUID, Integer> merged = mergeLines(req.lines());
        for (UUID id : merged.keySet()) {
            if (!items.existsById(id)) {
                throw new BadRequestException("An item in this cart no longer exists.");
            }
        }
        List<HeldLine> lines = merged.entrySet().stream().map(e -> new HeldLine(e.getKey(), e.getValue())).toList();
        PosHeldCart cart = new PosHeldCart();
        cart.setCreatedBy(actor.id());
        cart.setLabel(req.label() == null ? "" : req.label().trim());
        cart.setLines(json.writeValueAsString(lines));
        return toDto(heldCarts.save(cart));
    }

    @Transactional(readOnly = true)
    public List<HeldCartResponse> listHeld(PosActor actor) {
        return heldCarts.findByCreatedByOrderByCreatedAtDesc(actor.id()).stream().map(this::toDto).toList();
    }

    /** Returns the cart and removes it from the held list (resume = take it off the shelf). */
    @Transactional
    public HeldCartResponse resumeHeld(PosActor actor, UUID id) {
        PosHeldCart cart = ownedHeld(actor, id);
        HeldCartResponse dto = toDto(cart);
        heldCarts.delete(cart);
        return dto;
    }

    @Transactional
    public void discardHeld(PosActor actor, UUID id) {
        heldCarts.delete(ownedHeld(actor, id));
    }

    // ---- helpers -------------------------------------------------------------------------

    PosBill scoped(PosActor actor, UUID id) {
        PosBill b = bills.findById(id).orElseThrow(() -> new ResourceNotFoundException("Bill not found."));
        if (!actor.admin() && !b.getCreatedBy().equals(actor.id())) {
            throw new ResourceNotFoundException("Bill not found.");
        }
        return b;
    }

    private PosHeldCart ownedHeld(PosActor actor, UUID id) {
        return heldCarts.findById(id).filter(c -> c.getCreatedBy().equals(actor.id()))
                .orElseThrow(() -> new ResourceNotFoundException("Held bill not found."));
    }

    private static Map<UUID, Integer> mergeLines(List<HeldLine> lines) {
        Map<UUID, Integer> merged = new LinkedHashMap<>();
        for (HeldLine l : lines) {
            merged.merge(l.itemId(), l.quantity(), Integer::sum);
        }
        if (merged.values().stream().anyMatch(q -> q > 999)) {
            throw new BadRequestException("Quantity per item cannot exceed 999.");
        }
        return merged;
    }

    static void checkRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new BadRequestException("'to' date cannot be before 'from' date.");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new BadRequestException("Date range cannot exceed " + MAX_RANGE_DAYS + " days.");
        }
    }

    private HeldCartResponse toDto(PosHeldCart c) {
        return new HeldCartResponse(c.getId(), c.getLabel(), c.getCreatedAt(), json.readValue(c.getLines(), HELD_LINES));
    }

    private String nameOf(UUID userId) {
        return users.findById(userId).map(User::getFullName).orElse("");
    }

    private Map<UUID, String> names(Collection<UUID> ids) {
        return users.findAllById(ids.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));
    }

    private BillResponse toResponse(PosBill b) {
        List<PosBillItem> lines = billItems.findByBillIdInOrderByCreatedAtAsc(List.of(b.getId()));
        return toResponse(b, lines, Map.of(b.getCreatedBy(), nameOf(b.getCreatedBy())));
    }

    private BillResponse toResponse(PosBill b, List<PosBillItem> lines, Map<UUID, String> names) {
        return new BillResponse(b.getId(), b.getInvoiceNumber(), b.getBillDate(), b.getCreatedAt(),
                b.getCreatedBy(), names.getOrDefault(b.getCreatedBy(), ""), b.getStatus(), b.getVoidReason(),
                b.getVoidedAt(), b.getPaymentMethod(), "MANUAL_UNVERIFIED", b.getSubtotal(), b.getGstPercent(),
                b.getGstAmount(), b.getTotal(), b.getBusinessName(), b.getAddress(), b.getPhone(), b.getGstin(),
                b.getFooterMessage(), b.getCurrencySymbol(),
                lines.stream().map(i -> new BillLineResponse(i.getItemId(), i.getItemName(), i.getEmoji(),
                        i.getUnitPrice(), i.getQuantity(), i.getLineTotal())).toList());
    }
}
