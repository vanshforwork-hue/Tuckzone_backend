package com.school.canteen.billing;

import com.school.canteen.billing.PosDtos.AvailabilityRequest;
import com.school.canteen.billing.PosDtos.BillPage;
import com.school.canteen.billing.PosDtos.BillResponse;
import com.school.canteen.billing.PosDtos.CatalogResponse;
import com.school.canteen.billing.PosDtos.CategoryRequest;
import com.school.canteen.billing.PosDtos.CategoryResponse;
import com.school.canteen.billing.PosDtos.CreateBillRequest;
import com.school.canteen.billing.PosDtos.Granularity;
import com.school.canteen.billing.PosDtos.HeldCartResponse;
import com.school.canteen.billing.PosDtos.HoldRequest;
import com.school.canteen.billing.PosDtos.ItemRequest;
import com.school.canteen.billing.PosDtos.ItemResponse;
import com.school.canteen.billing.PosDtos.SalesSummary;
import com.school.canteen.billing.PosDtos.SettingsRequest;
import com.school.canteen.billing.PosDtos.SettingsResponse;
import com.school.canteen.billing.PosDtos.VoidRequest;
import com.school.canteen.security.AppUserDetails;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Counter billing (POS) API. Student, Parent and Teacher accounts are rejected by every method.
 *
 * <pre>
 * Sell (admin + sub admin): catalog read, settings read, create/list/read bills (sub admin:
 *                           own bills only), hold / resume / discard own carts, toggle item
 *                           availability.
 * Manage (admin only):      categories + items CRUD, settings update, void, reports, export.
 * </pre>
 * Every method carries its own {@code @PreAuthorize} so nothing depends on a class default.
 */
@RestController
@RequestMapping("/api/admin/billing")
public class PosController {

    private static final String STAFF = "hasAnyRole('CANTEEN_ADMIN','SUB_ADMIN')";
    private static final String ADMIN = "hasRole('CANTEEN_ADMIN')";
    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final PosCatalogService catalog;
    private final PosBillService billService;
    private final PosReportService reports;

    public PosController(PosCatalogService catalog, PosBillService billService, PosReportService reports) {
        this.catalog = catalog;
        this.billService = billService;
        this.reports = reports;
    }

    // ---- catalog -------------------------------------------------------------------------

    @GetMapping("/catalog")
    @PreAuthorize(STAFF)
    public CatalogResponse catalog() {
        return catalog.catalog();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ADMIN)
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest r) {
        return catalog.createCategory(r);
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize(ADMIN)
    public CategoryResponse updateCategory(@PathVariable UUID id, @Valid @RequestBody CategoryRequest r) {
        return catalog.updateCategory(id, r);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(ADMIN)
    public void archiveCategory(@PathVariable UUID id) {
        catalog.archiveCategory(id);
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ADMIN)
    public ItemResponse createItem(@Valid @RequestBody ItemRequest r) {
        return catalog.createItem(r);
    }

    @PutMapping("/items/{id}")
    @PreAuthorize(ADMIN)
    public ItemResponse updateItem(@PathVariable UUID id, @Valid @RequestBody ItemRequest r) {
        return catalog.updateItem(id, r);
    }

    /** The one catalog write a sub admin gets: mark an item sold out / back in stock. */
    @PatchMapping("/items/{id}/availability")
    @PreAuthorize(STAFF)
    public ItemResponse setAvailability(@PathVariable UUID id, @Valid @RequestBody AvailabilityRequest r) {
        return catalog.setAvailability(id, r);
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(ADMIN)
    public void archiveItem(@PathVariable UUID id) {
        catalog.archiveItem(id);
    }

    // ---- settings ------------------------------------------------------------------------

    @GetMapping("/settings")
    @PreAuthorize(STAFF)
    public SettingsResponse settings() {
        return catalog.getSettings();
    }

    @PutMapping("/settings")
    @PreAuthorize(ADMIN)
    public SettingsResponse updateSettings(@Valid @RequestBody SettingsRequest r) {
        return catalog.updateSettings(r);
    }

    // ---- bills ---------------------------------------------------------------------------

    @PostMapping("/bills")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(STAFF)
    public BillResponse createBill(@AuthenticationPrincipal AppUserDetails me, @Valid @RequestBody CreateBillRequest r) {
        return billService.create(PosActor.of(me), r);
    }

    @GetMapping("/bills")
    @PreAuthorize(STAFF)
    public BillPage listBills(@AuthenticationPrincipal AppUserDetails me,
                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                              @RequestParam(required = false) PosBill.Status status,
                              @RequestParam(required = false) String q,
                              @RequestParam(required = false) Integer page,
                              @RequestParam(required = false) Integer size) {
        return billService.search(PosActor.of(me), from, to, status, q, page, size);
    }

    /** The bill is the receipt; calling this again to reprint creates nothing. */
    @GetMapping("/bills/{id}")
    @PreAuthorize(STAFF)
    public BillResponse getBill(@AuthenticationPrincipal AppUserDetails me, @PathVariable UUID id) {
        return billService.get(PosActor.of(me), id);
    }

    @PostMapping("/bills/{id}/void")
    @PreAuthorize(ADMIN)
    public BillResponse voidBill(@AuthenticationPrincipal AppUserDetails me, @PathVariable UUID id,
                                 @Valid @RequestBody VoidRequest r) {
        return billService.voidBill(PosActor.of(me), id, r.reason());
    }

    // ---- held carts ----------------------------------------------------------------------

    @PostMapping("/held")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(STAFF)
    public HeldCartResponse hold(@AuthenticationPrincipal AppUserDetails me, @Valid @RequestBody HoldRequest r) {
        return billService.hold(PosActor.of(me), r);
    }

    @GetMapping("/held")
    @PreAuthorize(STAFF)
    public List<HeldCartResponse> held(@AuthenticationPrincipal AppUserDetails me) {
        return billService.listHeld(PosActor.of(me));
    }

    @PostMapping("/held/{id}/resume")
    @PreAuthorize(STAFF)
    public HeldCartResponse resume(@AuthenticationPrincipal AppUserDetails me, @PathVariable UUID id) {
        return billService.resumeHeld(PosActor.of(me), id);
    }

    @DeleteMapping("/held/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(STAFF)
    public void discard(@AuthenticationPrincipal AppUserDetails me, @PathVariable UUID id) {
        billService.discardHeld(PosActor.of(me), id);
    }

    // ---- reports (admin only: this is the canteen's commercial data) ---------------------

    @GetMapping("/reports/summary")
    @PreAuthorize(ADMIN)
    public SalesSummary summary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "DAY") Granularity granularity) {
        return reports.summary(from, to, granularity);
    }

    @GetMapping("/reports/export")
    @PreAuthorize(ADMIN)
    public ResponseEntity<byte[]> export(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"billing-" + from + "_" + to + ".xlsx\"")
                .contentType(MediaType.parseMediaType(XLSX))
                .body(reports.exportXlsx(from, to));
    }
}
