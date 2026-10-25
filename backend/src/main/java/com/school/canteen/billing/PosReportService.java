package com.school.canteen.billing;

import com.school.canteen.billing.PosDtos.Granularity;
import com.school.canteen.billing.PosDtos.ItemRow;
import com.school.canteen.billing.PosDtos.PaymentRow;
import com.school.canteen.billing.PosDtos.PeriodRow;
import com.school.canteen.billing.PosDtos.SalesSummary;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static java.time.temporal.TemporalAdjusters.previousOrSame;

/**
 * Sales summaries and the Excel export. Everything is summed from the persisted bill and
 * line rows (completed bills only), so a report can never disagree with the bills it lists.
 */
@Service
public class PosReportService {

    private final PosBillRepository bills;
    private final PosBillItemRepository billItems;
    private final ZoneId zone;

    public PosReportService(PosBillRepository bills, PosBillItemRepository billItems, ZoneId zone) {
        this.bills = bills;
        this.billItems = billItems;
        this.zone = zone;
    }

    @Transactional(readOnly = true)
    public SalesSummary summary(LocalDate from, LocalDate to, Granularity g) {
        PosBillService.checkRange(from, to);
        List<PosBill> done = bills.completedBetween(from, to);
        List<PosBill> voided = bills.voidedBetween(from, to);

        Map<LocalDate, List<PosBill>> byPeriod = done.stream()
                .collect(Collectors.groupingBy(b -> bucket(b.getBillDate(), g), TreeMap::new, Collectors.toList()));
        List<PeriodRow> periods = byPeriod.entrySet().stream().map(e -> new PeriodRow(e.getKey(),
                e.getValue().size(), sum(e.getValue(), PosBill::getSubtotal), sum(e.getValue(), PosBill::getGstAmount),
                sum(e.getValue(), PosBill::getTotal))).toList();

        Map<String, List<PosBill>> byMethod = done.stream().collect(Collectors.groupingBy(
                b -> b.getPaymentMethod() == null ? "UNRECORDED" : b.getPaymentMethod().name(), TreeMap::new, Collectors.toList()));
        List<PaymentRow> payments = byMethod.entrySet().stream()
                .map(e -> new PaymentRow(e.getKey(), e.getValue().size(), sum(e.getValue(), PosBill::getTotal))).toList();

        return new SalesSummary(from, to, g, done.size(), sum(done, PosBill::getSubtotal), sum(done, PosBill::getGstAmount),
                sum(done, PosBill::getTotal), voided.size(), sum(voided, PosBill::getTotal), periods, payments,
                itemRows(done));
    }

    /** Two sheets, as in the reference app: one row per bill, one row per line item. */
    @Transactional(readOnly = true)
    public byte[] exportXlsx(LocalDate from, LocalDate to) {
        PosBillService.checkRange(from, to);
        List<PosBill> done = bills.completedBetween(from, to);
        Map<UUID, List<PosBillItem>> lines = linesByBill(done);
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet s = wb.createSheet("Summary");
            row(s, 0, "Bill No", "Date", "Time", "Items", "Payment (manual)", "Subtotal", "GST %", "GST", "Total");
            int r = 1;
            for (PosBill b : done) {
                String items = lines.getOrDefault(b.getId(), List.of()).stream()
                        .map(i -> i.getItemName() + " x" + i.getQuantity()).collect(Collectors.joining(", "));
                Row row = s.createRow(r++);
                cells(row, b.getInvoiceNumber(), b.getBillDate().toString(),
                        b.getCreatedAt().atZone(zone).toLocalTime().withNano(0).toString(), items,
                        b.getPaymentMethod() == null ? "" : b.getPaymentMethod().name());
                num(row, 5, b.getSubtotal(), b.getGstPercent(), b.getGstAmount(), b.getTotal());
            }
            Row t = s.createRow(r + 1);
            cells(t, "Total (" + done.size() + " bills)");
            num(t, 5, sum(done, PosBill::getSubtotal), null, sum(done, PosBill::getGstAmount), sum(done, PosBill::getTotal));

            Sheet d = wb.createSheet("Item Details");
            row(d, 0, "Bill No", "Item", "Qty", "Unit Price", "Line Total");
            int dr = 1;
            for (PosBill b : done) {
                for (PosBillItem i : lines.getOrDefault(b.getId(), List.of())) {
                    Row row = d.createRow(dr++);
                    cells(row, b.getInvoiceNumber(), i.getItemName());
                    num(row, 2, BigDecimal.valueOf(i.getQuantity()), i.getUnitPrice(), i.getLineTotal());
                }
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---- helpers -------------------------------------------------------------------------

    private List<ItemRow> itemRows(List<PosBill> done) {
        Map<String, long[]> qty = new TreeMap<>();
        Map<String, BigDecimal> money = new TreeMap<>();
        for (List<PosBillItem> ls : linesByBill(done).values()) {
            for (PosBillItem i : ls) {
                qty.computeIfAbsent(i.getItemName(), k -> new long[1])[0] += i.getQuantity();
                money.merge(i.getItemName(), i.getLineTotal(), BigDecimal::add);
            }
        }
        return qty.entrySet().stream().map(e -> new ItemRow(e.getKey(), e.getValue()[0], money.get(e.getKey())))
                .sorted(Comparator.comparing(ItemRow::total).reversed()).toList();
    }

    private Map<UUID, List<PosBillItem>> linesByBill(List<PosBill> done) {
        if (done.isEmpty()) {
            return Map.of();
        }
        return billItems.findByBillIdInOrderByCreatedAtAsc(done.stream().map(PosBill::getId).toList()).stream()
                .collect(Collectors.groupingBy(PosBillItem::getBillId));
    }

    private static LocalDate bucket(LocalDate d, Granularity g) {
        return switch (g) {
            case DAY -> d;
            case WEEK -> d.with(previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> d.withDayOfMonth(1);
        };
    }

    private static BigDecimal sum(List<PosBill> list, java.util.function.Function<PosBill, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2);
    }

    private static void row(Sheet s, int idx, String... heads) {
        cells(s.createRow(idx), heads);
    }

    private static void cells(Row row, String... values) {
        for (int c = 0; c < values.length; c++) {
            row.createCell(c).setCellValue(values[c]);
        }
    }

    private static void num(Row row, int start, BigDecimal... values) {
        for (int c = 0; c < values.length; c++) {
            if (values[c] != null) {
                row.createCell(start + c).setCellValue(values[c].doubleValue());
            }
        }
    }
}
