package com.school.canteen.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.school.canteen.IntegrationTestBase;
import com.school.canteen.entity.User;
import com.school.canteen.enums.Role;
import com.school.canteen.enums.UserStatus;
import com.school.canteen.repository.UserRepository;
import com.school.canteen.security.JwtService;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Billing API against real Postgres + Flyway, through the real security filter chain
 * (a JWT per role), so authorization is tested as clients experience it.
 */
@AutoConfigureMockMvc
class BillingIntegrationTest extends IntegrationTestBase {

    private static final String BASE = "/api/admin/billing";
    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository users;
    @Autowired private JwtService jwt;
    @Autowired private PosCatalogService catalogService;

    private static String admin;
    private static String sub1;
    private static String sub2;
    private static String student;
    private static String parent;
    private static String teacher;
    private static boolean seeded;

    private UUID categoryId;
    private UUID samosa;   // 10.00
    private UUID tea;      // 7.50
    private UUID soldOut;  // 5.00, unavailable

    private String token(Role role) {
        User u = new User();
        u.setFullName(role + " " + SEQ.incrementAndGet());
        u.setEmail(role.name().toLowerCase() + SEQ.get() + "@billing.test");
        u.setMobile("9" + String.format("%09d", 700000000 + SEQ.get()));
        u.setPasswordHash("x");
        u.setRole(role);
        u.setStatus(UserStatus.ACTIVE);
        u.setEmailVerified(true);
        users.save(u);
        return jwt.generateAccessToken(u.getEmail(), role.name());
    }

    private void seed() throws Exception {
        if (!seeded) {
            admin = token(Role.CANTEEN_ADMIN);
            sub1 = token(Role.SUB_ADMIN);
            sub2 = token(Role.SUB_ADMIN);
            student = token(Role.STUDENT);
            parent = token(Role.PARENT);
            teacher = token(Role.TEACHER);
            seeded = true;
        }
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        categoryId = id(call(admin, post(BASE + "/categories"), "{\"name\":\"Snacks " + suffix + "\"}", 201));
        samosa = id(call(admin, post(BASE + "/items"), item(categoryId, "Samosa " + suffix, "10.00", true), 201));
        tea = id(call(admin, post(BASE + "/items"), item(categoryId, "Tea " + suffix, "7.50", true), 201));
        soldOut = id(call(admin, post(BASE + "/items"), item(categoryId, "Gone " + suffix, "5.00", false), 201));
    }

    // ---- helpers -------------------------------------------------------------------------

    private static String item(UUID cat, String name, String price, boolean available) {
        return "{\"categoryId\":\"%s\",\"name\":\"%s\",\"price\":%s,\"available\":%s}".formatted(cat, name, price, available);
    }

    private static String bill(String key, boolean gst, String method, Object... idQty) {
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < idQty.length; i += 2) {
            lines.add("{\"itemId\":\"%s\",\"quantity\":%s}".formatted(idQty[i], idQty[i + 1]));
        }
        return "{\"idempotencyKey\":\"%s\",\"gstEnabled\":%s,%s\"lines\":[%s]}".formatted(key, gst,
                method == null ? "" : "\"paymentMethod\":\"" + method + "\",", String.join(",", lines));
    }

    private JsonNode call(String token, MockHttpServletRequestBuilder req, String body, int expectedStatus) throws Exception {
        MockHttpServletResponse res = raw(token, req, body);
        assertThat(res.getStatus()).as("%s -> %s", req, res.getContentAsString()).isEqualTo(expectedStatus);
        String text = res.getContentAsString();
        return text.isBlank() ? json.createObjectNode() : json.readTree(text);
    }

    private MockHttpServletResponse raw(String token, MockHttpServletRequestBuilder req, String body) throws Exception {
        if (token != null) {
            req.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(req).andReturn().getResponse();
    }

    private static UUID id(JsonNode n) {
        return UUID.fromString(n.get("id").asText());
    }

    private JsonNode createBill(String token, String body) throws Exception {
        return call(token, post(BASE + "/bills"), body, 201);
    }

    private static String key() {
        return "k-" + UUID.randomUUID();
    }

    // ---- authorization -------------------------------------------------------------------

    @Test
    @DisplayName("student, parent, teacher and anonymous callers are denied on every billing endpoint")
    void nonStaffDenied() throws Exception {
        seed();
        String anyId = UUID.randomUUID().toString();
        String today = LocalDate.now().toString();
        String[][] endpoints = {
                {"GET", "/catalog"}, {"POST", "/categories"}, {"PUT", "/categories/" + anyId}, {"DELETE", "/categories/" + anyId},
                {"POST", "/items"}, {"PUT", "/items/" + anyId}, {"PATCH", "/items/" + anyId + "/availability"},
                {"DELETE", "/items/" + anyId}, {"GET", "/settings"}, {"PUT", "/settings"}, {"POST", "/bills"},
                {"GET", "/bills"}, {"GET", "/bills/" + anyId}, {"POST", "/bills/" + anyId + "/void"}, {"POST", "/held"},
                {"GET", "/held"}, {"POST", "/held/" + anyId + "/resume"}, {"DELETE", "/held/" + anyId},
                {"GET", "/reports/summary?from=" + today + "&to=" + today},
                {"GET", "/reports/export?from=" + today + "&to=" + today},
        };
        for (String[] e : endpoints) {
            for (String t : new String[] {student, parent, teacher}) {
                assertThat(raw(t, builder(e), "{}").getStatus()).as("%s %s", e[0], e[1]).isEqualTo(403);
            }
            assertThat(raw(null, builder(e), "{}").getStatus()).as("anon %s %s", e[0], e[1]).isEqualTo(401);
        }
    }

    private MockHttpServletRequestBuilder builder(String[] e) {
        String url = BASE + e[1];
        return switch (e[0]) {
            case "GET" -> get(url);
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "PATCH" -> patch(url);
            default -> delete(url);
        };
    }

    @Test
    @DisplayName("sub admin can sell and read, but cannot manage catalog/settings, void, or see reports")
    void subAdminPermissions() throws Exception {
        seed();
        call(sub1, get(BASE + "/catalog"), null, 200);
        call(sub1, get(BASE + "/settings"), null, 200);
        call(sub1, patch(BASE + "/items/" + samosa + "/availability"), "{\"available\":false}", 200);
        call(sub1, patch(BASE + "/items/" + samosa + "/availability"), "{\"available\":true}", 200);
        JsonNode b = createBill(sub1, bill(key(), false, "CASH", samosa, 1));

        call(sub1, post(BASE + "/categories"), "{\"name\":\"Nope\"}", 403);
        call(sub1, put(BASE + "/items/" + samosa), item(categoryId, "Cheap", "1.00", true), 403);
        call(sub1, delete(BASE + "/items/" + samosa), null, 403);
        call(sub1, delete(BASE + "/categories/" + categoryId), null, 403);
        call(sub1, put(BASE + "/settings"), settingsJson("5.00"), 403);
        call(sub1, post(BASE + "/bills/" + b.get("id").asText() + "/void"), "{\"reason\":\"x\"}", 403);
        String d = LocalDate.now().toString();
        call(sub1, get(BASE + "/reports/summary?from=" + d + "&to=" + d), null, 403);
        call(sub1, get(BASE + "/reports/export?from=" + d + "&to=" + d), null, 403);
    }

    @Test
    @DisplayName("a sub admin only sees its own bills and held carts; admin sees all; foreign ids answer 404")
    void scopeIsolation() throws Exception {
        seed();
        JsonNode b1 = createBill(sub1, bill(key(), false, null, samosa, 1));
        JsonNode b2 = createBill(sub2, bill(key(), false, null, tea, 1));

        call(sub2, get(BASE + "/bills/" + b1.get("id").asText()), null, 404);
        call(sub1, get(BASE + "/bills/" + b1.get("id").asText()), null, 200);
        call(admin, get(BASE + "/bills/" + b1.get("id").asText()), null, 200);

        String today = LocalDate.now().toString();
        JsonNode mine = call(sub2, get(BASE + "/bills?from=" + today + "&to=" + today + "&size=200"), null, 200);
        Set<String> ids = new java.util.HashSet<>();
        mine.get("content").forEach(n -> ids.add(n.get("id").asText()));
        assertThat(ids).contains(b2.get("id").asText()).doesNotContain(b1.get("id").asText());

        JsonNode all = call(admin, get(BASE + "/bills?from=" + today + "&to=" + today + "&size=200"), null, 200);
        Set<String> allIds = new java.util.HashSet<>();
        all.get("content").forEach(n -> allIds.add(n.get("id").asText()));
        assertThat(allIds).contains(b1.get("id").asText(), b2.get("id").asText());

        JsonNode held = call(sub1, post(BASE + "/held"), "{\"label\":\"t1\",\"lines\":[{\"itemId\":\"" + samosa + "\",\"quantity\":2}]}", 201);
        String heldId = held.get("id").asText();
        call(sub2, post(BASE + "/held/" + heldId + "/resume"), null, 404);
        call(sub2, delete(BASE + "/held/" + heldId), null, 404);
        assertThat(call(sub2, get(BASE + "/held"), null, 200).size()).isZero();
        JsonNode resumed = call(sub1, post(BASE + "/held/" + heldId + "/resume"), null, 200);
        assertThat(resumed.get("lines").get(0).get("quantity").asInt()).isEqualTo(2);
        assertThat(call(sub1, get(BASE + "/held"), null, 200).size()).isZero();
    }

    // ---- calculation, validation, numbering ----------------------------------------------

    @Test
    @DisplayName("GST is exclusive, rounded half-up to the paisa, and total = subtotal + GST")
    void gstMath() {
        assertThat(PosBillService.computeGst(new BigDecimal("10.00"), new BigDecimal("5.00"))).isEqualByComparingTo("0.50");
        assertThat(PosBillService.computeGst(new BigDecimal("0.10"), new BigDecimal("5.00"))).isEqualByComparingTo("0.01");   // 0.005 -> up
        assertThat(PosBillService.computeGst(new BigDecimal("0.09"), new BigDecimal("5.00"))).isEqualByComparingTo("0.00");   // 0.0045 -> down
        assertThat(PosBillService.computeGst(new BigDecimal("33.33"), new BigDecimal("18.00"))).isEqualByComparingTo("6.00"); // 5.9994
        assertThat(PosBillService.computeGst(new BigDecimal("12.50"), BigDecimal.ZERO)).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("bill uses server-side prices, applies GST, numbers sequentially, and snapshots lines")
    void createBillTotalsAndNumbering() throws Exception {
        seed();
        // default GST 5%: 3 x 10.00 + 3 x 7.50 = 52.50, GST 2.625 -> 2.63
        JsonNode b = createBill(admin, bill(key(), true, "UPI", samosa, 3, tea, 3));
        assertThat(b.get("subtotal").decimalValue()).isEqualByComparingTo("52.50");
        assertThat(b.get("gstPercent").decimalValue()).isEqualByComparingTo("5.00");
        assertThat(b.get("gstAmount").decimalValue()).isEqualByComparingTo("2.63");
        assertThat(b.get("total").decimalValue()).isEqualByComparingTo("55.13");
        assertThat(b.get("paymentMethod").asText()).isEqualTo("UPI");
        assertThat(b.get("paymentStatus").asText()).isEqualTo("MANUAL_UNVERIFIED");
        assertThat(b.get("lines").size()).isEqualTo(2);
        assertThat(b.get("invoiceNumber").asText()).matches("INV-\\d{8}-\\d{4,}");

        JsonNode noTax = createBill(admin, bill(key(), false, null, samosa, 1));
        assertThat(noTax.get("gstAmount").decimalValue()).isEqualByComparingTo("0.00");
        assertThat(noTax.get("total").decimalValue()).isEqualByComparingTo("10.00");
        assertThat(noTax.get("gstPercent").decimalValue()).isEqualByComparingTo("0.00");

        // same item sent on two lines merges into one
        JsonNode merged = createBill(admin, bill(key(), false, null, samosa, 1, samosa, 2));
        assertThat(merged.get("lines").size()).isEqualTo(1);
        assertThat(merged.get("total").decimalValue()).isEqualByComparingTo("30.00");

        assertThat(b.get("invoiceNumber").asText()).isNotEqualTo(noTax.get("invoiceNumber").asText());
    }

    @Test
    @DisplayName("invalid carts are rejected: empty, bad quantity, unavailable or unknown item")
    void validation() throws Exception {
        seed();
        call(admin, post(BASE + "/bills"), "{\"idempotencyKey\":\"" + key() + "\",\"gstEnabled\":true,\"lines\":[]}", 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, null, samosa, 0), 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, null, samosa, -2), 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, null, samosa, 1000), 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, null, samosa, 600, samosa, 600), 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, null, soldOut, 1), 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, null, UUID.randomUUID(), 1), 400);
        call(admin, post(BASE + "/bills"), "{\"gstEnabled\":true,\"lines\":[{\"itemId\":\"" + samosa + "\",\"quantity\":1}]}", 400);
        call(admin, post(BASE + "/bills"), bill(key(), true, "BITCOIN", samosa, 1), 400);

        // a zero-priced cart cannot become a bill
        UUID free = id(call(admin, post(BASE + "/items"), item(categoryId, "Free " + key(), "0.00", true), 201));
        call(admin, post(BASE + "/bills"), bill(key(), true, null, free, 1), 400);

        // catalog input validation
        call(admin, post(BASE + "/items"), item(categoryId, "Neg", "-1.00", true), 400);
        call(admin, post(BASE + "/items"), item(categoryId, "Frac", "1.234", true), 400);
        call(admin, post(BASE + "/items"), item(categoryId, " ", "1.00", true), 400);
        call(admin, post(BASE + "/items"), item(UUID.randomUUID(), "Orphan", "1.00", true), 404);
        call(admin, put(BASE + "/settings"), settingsJson("101.00"), 400);
        call(admin, put(BASE + "/settings"), settingsJson("-1"), 400);
    }

    @Test
    @DisplayName("replaying the same idempotency key returns the original bill; no second sale")
    void idempotent() throws Exception {
        seed();
        String k = key();
        JsonNode first = createBill(sub1, bill(k, true, "CASH", samosa, 1));
        MockHttpServletResponse again = raw(sub1, post(BASE + "/bills"), bill(k, true, "CASH", samosa, 1));
        assertThat(again.getStatus()).isEqualTo(201);
        assertThat(json.readTree(again.getContentAsString()).get("id").asText()).isEqualTo(first.get("id").asText());

        // a different account may reuse the key string: keys are per-creator
        JsonNode other = createBill(sub2, bill(k, true, "CASH", samosa, 1));
        assertThat(other.get("id").asText()).isNotEqualTo(first.get("id").asText());
    }

    @Test
    @DisplayName("concurrent checkouts get distinct invoice numbers; concurrent duplicates collapse to one bill")
    void concurrency() throws Exception {
        seed();
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<String>> distinct = new ArrayList<>();
            for (int i = 0; i < 16; i++) {
                String body = bill(key(), true, null, samosa, 1);
                distinct.add(() -> createBill(admin, body).get("invoiceNumber").asText());
            }
            Set<String> numbers = new java.util.HashSet<>();
            for (Future<String> f : pool.invokeAll(distinct)) {
                numbers.add(f.get());
            }
            assertThat(numbers).hasSize(16);

            String dupKey = key();
            String body = bill(dupKey, true, null, tea, 1);
            List<Callable<String>> dupes = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                dupes.add(() -> json.readTree(raw(sub1, post(BASE + "/bills"), body).getContentAsString()).get("id").asText());
            }
            Set<String> billIds = new java.util.HashSet<>();
            for (Future<String> f : pool.invokeAll(dupes)) {
                billIds.add(f.get());
            }
            assertThat(billIds).hasSize(1);
        } finally {
            pool.shutdownNow();
        }
    }

    // ---- historical stability ------------------------------------------------------------

    @Test
    @DisplayName("editing/archiving items and changing settings never alters an issued bill or its reprint")
    void historyIsStable() throws Exception {
        seed();
        JsonNode original = createBill(admin, bill(key(), true, "CASH", samosa, 2));
        String billId = original.get("id").asText();

        call(admin, put(BASE + "/items/" + samosa), item(categoryId, "Renamed Samosa", "99.00", true), 200);
        call(admin, delete(BASE + "/items/" + samosa), null, 204);
        call(admin, put(BASE + "/settings"), settingsJson("18.00"), 200);
        JsonNode reprint;
        try {
            reprint = call(admin, get(BASE + "/bills/" + billId), null, 200);
        } finally {
            // restore GST so other tests keep their arithmetic, even if the call above failed
            call(admin, put(BASE + "/settings"), settingsJson("5.00"), 200);
        }
        assertThat(reprint).isEqualTo(original);
        assertThat(reprint.get("lines").get(0).get("unitPrice").decimalValue()).isEqualByComparingTo("10.00");
        assertThat(reprint.get("businessName").asText()).isEqualTo(original.get("businessName").asText());

        // the retired item can no longer be sold
        call(admin, post(BASE + "/bills"), bill(key(), true, null, samosa, 1), 400);
    }

    private static String settingsJson(String gst) {
        return ("{\"businessName\":\"TuckZone Canteen\",\"address\":\"\",\"phone\":\"\",\"gstin\":\"\","
                + "\"footerMessage\":\"Thanks\",\"currencySymbol\":\"Rs\",\"gstPercent\":%s,\"gstEnabledDefault\":true}").formatted(gst);
    }

    // ---- catalog -------------------------------------------------------------------------

    @Test
    @DisplayName("catalog CRUD: duplicates conflict, category with items cannot be archived, availability toggles")
    void catalogCrud() throws Exception {
        seed();
        String name = "Dup " + key();
        call(admin, post(BASE + "/items"), item(categoryId, name, "3.00", true), 201);
        call(admin, post(BASE + "/items"), item(categoryId, name.toUpperCase(), "3.00", true), 409);
        call(admin, post(BASE + "/categories"), "{\"name\":\"" + name + "\"}", 201);
        call(admin, post(BASE + "/categories"), "{\"name\":\"" + name.toLowerCase() + "\"}", 409);
        call(admin, delete(BASE + "/categories/" + categoryId), null, 409);

        JsonNode toggled = call(admin, patch(BASE + "/items/" + tea + "/availability"), "{\"available\":false}", 200);
        assertThat(toggled.get("available").asBoolean()).isFalse();
        call(admin, post(BASE + "/bills"), bill(key(), true, null, tea, 1), 400);
        call(admin, patch(BASE + "/items/" + tea + "/availability"), "{\"available\":true}", 200);
        createBill(admin, bill(key(), true, null, tea, 1));

        JsonNode catalog = call(sub1, get(BASE + "/catalog"), null, 200);
        assertThat(catalog.get("items").size()).isGreaterThanOrEqualTo(3);
        call(admin, get(BASE + "/bills/" + UUID.randomUUID()), null, 404);
    }

    // ---- void + reports ------------------------------------------------------------------

    @Test
    @DisplayName("void keeps the bill on file, drops it from sales, and cannot be repeated")
    void voidFlow() throws Exception {
        seed();
        String today = LocalDate.now().toString();
        JsonNode before = call(admin, get(BASE + "/reports/summary?from=" + today + "&to=" + today), null, 200);

        JsonNode b = createBill(admin, bill(key(), false, "CASH", samosa, 1));
        String billId = b.get("id").asText();
        call(admin, post(BASE + "/bills/" + billId + "/void"), "{\"reason\":\" \"}", 400);
        JsonNode voided = call(admin, post(BASE + "/bills/" + billId + "/void"), "{\"reason\":\"Wrong item\"}", 200);
        assertThat(voided.get("status").asText()).isEqualTo("VOID");
        assertThat(voided.get("voidReason").asText()).isEqualTo("Wrong item");
        assertThat(voided.get("total").decimalValue()).isEqualByComparingTo("10.00");
        call(admin, post(BASE + "/bills/" + billId + "/void"), "{\"reason\":\"again\"}", 409);

        JsonNode after = call(admin, get(BASE + "/reports/summary?from=" + today + "&to=" + today), null, 200);
        assertThat(after.get("bills").asLong()).isEqualTo(before.get("bills").asLong());
        assertThat(after.get("total").decimalValue()).isEqualByComparingTo(before.get("total").decimalValue());
        assertThat(after.get("voidedBills").asLong()).isEqualTo(before.get("voidedBills").asLong() + 1);

        JsonNode voidList = call(admin, get(BASE + "/bills?from=" + today + "&to=" + today + "&status=VOID&size=200"), null, 200);
        assertThat(voidList.get("content").toString()).contains(billId);
    }

    @Test
    @DisplayName("reports reconcile exactly with the persisted bills, and the export matches the report")
    void reportsReconcile() throws Exception {
        seed();
        createBill(admin, bill(key(), true, "CASH", samosa, 2, tea, 1));
        createBill(sub1, bill(key(), true, "UPI", tea, 3));
        createBill(sub2, bill(key(), false, null, samosa, 1));

        String today = LocalDate.now().toString();
        JsonNode summary = call(admin, get(BASE + "/reports/summary?from=" + today + "&to=" + today + "&granularity=DAY"), null, 200);
        JsonNode list = call(admin, get(BASE + "/bills?from=" + today + "&to=" + today + "&status=COMPLETED&size=200"), null, 200);

        BigDecimal listed = BigDecimal.ZERO;
        for (JsonNode n : list.get("content")) {
            listed = listed.add(n.get("total").decimalValue());
        }
        assertThat(summary.get("bills").asLong()).isEqualTo(list.get("totalElements").asLong());
        assertThat(summary.get("total").decimalValue()).isEqualByComparingTo(listed);
        assertThat(summary.get("subtotal").decimalValue().add(summary.get("gst").decimalValue()))
                .isEqualByComparingTo(summary.get("total").decimalValue());

        BigDecimal periods = BigDecimal.ZERO;
        long periodBills = 0;
        for (JsonNode p : summary.get("periods")) {
            periods = periods.add(p.get("total").decimalValue());
            periodBills += p.get("bills").asLong();
        }
        BigDecimal byPay = BigDecimal.ZERO;
        long payBills = 0;
        for (JsonNode p : summary.get("byPayment")) {
            byPay = byPay.add(p.get("total").decimalValue());
            payBills += p.get("bills").asLong();
        }
        BigDecimal byItem = BigDecimal.ZERO;
        for (JsonNode p : summary.get("byItem")) {
            byItem = byItem.add(p.get("total").decimalValue());
        }
        assertThat(periods).isEqualByComparingTo(summary.get("total").decimalValue());
        assertThat(byPay).isEqualByComparingTo(summary.get("total").decimalValue());
        assertThat(byItem).isEqualByComparingTo(summary.get("subtotal").decimalValue());
        assertThat(periodBills).isEqualTo(summary.get("bills").asLong());
        assertThat(payBills).isEqualTo(summary.get("bills").asLong());

        // week / month roll-ups must reconcile to the same totals
        for (String g : new String[] {"WEEK", "MONTH"}) {
            JsonNode s = call(admin, get(BASE + "/reports/summary?from=" + today + "&to=" + today + "&granularity=" + g), null, 200);
            assertThat(s.get("total").decimalValue()).isEqualByComparingTo(summary.get("total").decimalValue());
            assertThat(s.get("periods").size()).isEqualTo(1);
        }

        MockHttpServletResponse xlsx = raw(admin, get(BASE + "/reports/export?from=" + today + "&to=" + today), null);
        assertThat(xlsx.getStatus()).isEqualTo(200);
        assertThat(xlsx.getContentType()).contains("spreadsheetml");
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(xlsx.getContentAsByteArray()))) {
            // header + one row per bill + blank + total row
            assertThat(wb.getSheet("Summary").getLastRowNum()).isEqualTo(summary.get("bills").asInt() + 2);
            assertThat(wb.getSheet("Item Details").getLastRowNum()).isGreaterThanOrEqualTo(summary.get("bills").asInt());
        }
    }

    @Test
    @DisplayName("date range is validated and bounded")
    void rangeValidation() throws Exception {
        seed();
        call(admin, get(BASE + "/reports/summary?from=2026-02-01&to=2026-01-01"), null, 400);
        call(admin, get(BASE + "/reports/summary?from=2020-01-01&to=2026-01-01"), null, 400);
        call(admin, get(BASE + "/bills?from=2020-01-01&to=2026-01-01"), null, 400);
        call(admin, get(BASE + "/reports/summary?from=garbage&to=2026-01-01"), null, 400);
    }

    @Test
    @DisplayName("bill search matches on invoice number")
    void searchByInvoice() throws Exception {
        seed();
        JsonNode b = createBill(admin, bill(key(), false, null, samosa, 1));
        String inv = b.get("invoiceNumber").asText();
        String today = LocalDate.now().toString();
        JsonNode hit = call(admin, get(BASE + "/bills?from=" + today + "&to=" + today + "&q=" + inv.toLowerCase()), null, 200);
        assertThat(hit.get("totalElements").asInt()).isEqualTo(1);
        assertThat(hit.get("content").get(0).get("itemCount").asInt()).isEqualTo(1);
    }

    @Test
    @DisplayName("reprinting (reading a bill, repeatedly) creates no bill and changes no totals")
    void reprintCreatesNothing() throws Exception {
        seed();
        JsonNode b = createBill(sub1, bill(key(), true, "CASH", samosa, 2));
        String today = LocalDate.now().toString();
        String list = BASE + "/bills?from=" + today + "&to=" + today + "&size=200";
        long before = call(admin, get(list), null, 200).get("totalElements").asLong();
        JsonNode sales = call(admin, get(BASE + "/reports/summary?from=" + today + "&to=" + today), null, 200);

        for (int i = 0; i < 3; i++) {
            assertThat(call(sub1, get(BASE + "/bills/" + b.get("id").asText()), null, 200)).isEqualTo(b);
        }
        assertThat(call(admin, get(list), null, 200).get("totalElements").asLong()).isEqualTo(before);
        assertThat(call(admin, get(BASE + "/reports/summary?from=" + today + "&to=" + today), null, 200))
                .isEqualTo(sales);
    }
}
