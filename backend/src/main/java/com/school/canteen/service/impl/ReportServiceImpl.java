package com.school.canteen.service.impl;

import com.school.canteen.config.AppProperties;
import com.school.canteen.dto.report.DailySalesRow;
import com.school.canteen.dto.report.DashboardResponse;
import com.school.canteen.dto.report.ExpenseRequest;
import com.school.canteen.dto.report.ExpenseResponse;
import com.school.canteen.dto.report.LowStockRow;
import com.school.canteen.dto.report.PeakHourRow;
import com.school.canteen.dto.report.SalesReportResponse;
import com.school.canteen.dto.report.TopItemRow;
import com.school.canteen.entity.Expense;
import com.school.canteen.enums.MenuType;
import com.school.canteen.enums.OrderStatus;
import com.school.canteen.exception.BadRequestException;
import com.school.canteen.exception.ResourceNotFoundException;
import com.school.canteen.repository.DailyMenuItemRepository;
import com.school.canteen.repository.ExpenseRepository;
import com.school.canteen.repository.OrderRepository;
import com.school.canteen.repository.UserRepository;
import com.school.canteen.service.ReportService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportServiceImpl implements ReportService {

    /** Statuses that mean "still owed to a customer" on the day's board. There is no
     *  intermediate kitchen-workflow status anymore — an order is either PLACED (owed) or
     *  DELIVERED. */
    private static final Set<OrderStatus> IN_PROGRESS = Set.of(OrderStatus.PLACED);

    /** Below this fraction of the day's stock, an item is worth flagging to the admin. */
    private static final double LOW_STOCK_FRACTION = 0.2;

    /** Guards against a report request spanning years and scanning the whole table. */
    private static final int MAX_REPORT_DAYS = 400;

    private final OrderRepository orderRepository;
    private final ExpenseRepository expenseRepository;
    private final DailyMenuItemRepository dailyMenuItemRepository;
    private final UserRepository userRepository;
    private final AppProperties appProperties;

    public ReportServiceImpl(OrderRepository orderRepository,
                             ExpenseRepository expenseRepository,
                             DailyMenuItemRepository dailyMenuItemRepository,
                             UserRepository userRepository,
                             AppProperties appProperties) {
        this.orderRepository = orderRepository;
        this.expenseRepository = expenseRepository;
        this.dailyMenuItemRepository = dailyMenuItemRepository;
        this.userRepository = userRepository;
        this.appProperties = appProperties;
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardResponse dashboard(LocalDate date) {
        BigDecimal revenue = orderRepository.revenueBetween(date, date);
        BigDecimal cogs = orderRepository.costOfGoodsBetween(date, date);
        BigDecimal expenses = expenseRepository.totalBetween(date, date);
        BigDecimal grossProfit = revenue.subtract(cogs);

        List<LowStockRow> lowStock = dailyMenuItemRepository.findByMenuDate(date).stream()
                .filter(entry -> entry.getTotalQuantity() > 0)
                .filter(entry -> entry.getRemainingQuantity()
                        <= entry.getTotalQuantity() * LOW_STOCK_FRACTION)
                .map(entry -> new LowStockRow(entry.getMenuItem().getName(),
                        entry.getRemainingQuantity(), entry.getTotalQuantity()))
                .toList();

        List<TopItemRow> allItems = allTopItems(date, date);

        return new DashboardResponse(
                date,
                orderRepository.countByMenuDate(date),
                orderRepository.countByMenuDateAndStatusIn(date, IN_PROGRESS),
                orderRepository.countByMenuDateAndStatus(date, OrderStatus.DELIVERED),
                orderRepository.countByMenuDateAndStatus(date, OrderStatus.REJECTED),
                orderRepository.countByMenuDateAndStatus(date, OrderStatus.CANCELLED),
                revenue,
                cogs,
                grossProfit,
                expenses,
                grossProfit.subtract(expenses),
                userRepository.count(),
                limit(allItems, 5),
                limit(byType(allItems, MenuType.DAILY), 5),
                limit(byType(allItems, MenuType.FIXED), 5),
                lowStock);
    }

    @Override
    @Transactional(readOnly = true)
    public SalesReportResponse salesReport(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new BadRequestException("'to' date must not be before 'from' date");
        }
        if (from.plusDays(MAX_REPORT_DAYS).isBefore(to)) {
            throw new BadRequestException("Report range cannot exceed " + MAX_REPORT_DAYS + " days");
        }

        BigDecimal revenue = orderRepository.revenueBetween(from, to);
        BigDecimal cogs = orderRepository.costOfGoodsBetween(from, to);
        BigDecimal expenses = expenseRepository.totalBetween(from, to);
        BigDecimal grossProfit = revenue.subtract(cogs);

        List<DailySalesRow> daily = orderRepository.dailySalesBetween(from, to).stream()
                .map(row -> new DailySalesRow(
                        (LocalDate) row[0],
                        ((Number) row[1]).longValue(),
                        (BigDecimal) row[2]))
                .toList();
        long orderCount = daily.stream().mapToLong(DailySalesRow::orders).sum();

        List<PeakHourRow> peakHours = orderRepository
                .peakHoursBetween(from, to, appProperties.timezone()).stream()
                .map(row -> new PeakHourRow(
                        ((Number) row[0]).intValue(),
                        ((Number) row[1]).longValue()))
                .toList();

        List<TopItemRow> allItems = allTopItems(from, to);

        return new SalesReportResponse(from, to, revenue, cogs, grossProfit, expenses,
                grossProfit.subtract(expenses), orderCount, daily,
                limit(allItems, 10),
                limit(byType(allItems, MenuType.DAILY), 10),
                limit(byType(allItems, MenuType.FIXED), 10),
                peakHours);
    }

    @Override
    @Transactional
    public ExpenseResponse addExpense(ExpenseRequest request) {
        Expense expense = new Expense();
        expense.setExpenseDate(request.expenseDate());
        expense.setCategory(request.category());
        expense.setDescription(request.description());
        expense.setAmount(request.amount());
        expenseRepository.save(expense);
        return toResponse(expense);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseResponse> listExpenses(LocalDate from, LocalDate to) {
        return expenseRepository.findByExpenseDateBetweenOrderByExpenseDateDesc(from, to).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public void deleteExpense(UUID id) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found: " + id));
        expenseRepository.delete(expense);
    }

    /** Every item sold in the period, already ordered by quantity descending (from the
     *  query); callers slice/filter this in memory rather than re-querying per view. */
    private List<TopItemRow> allTopItems(LocalDate from, LocalDate to) {
        return orderRepository.topItemsBetween(from, to).stream()
                .map(row -> new TopItemRow(
                        (String) row[0],
                        (MenuType) row[1],
                        ((Number) row[2]).longValue(),
                        (BigDecimal) row[3]))
                .toList();
    }

    private List<TopItemRow> byType(List<TopItemRow> items, MenuType menuType) {
        return items.stream().filter(item -> item.menuType() == menuType).toList();
    }

    private List<TopItemRow> limit(List<TopItemRow> items, int limit) {
        return items.stream().limit(limit).toList();
    }

    private ExpenseResponse toResponse(Expense expense) {
        return new ExpenseResponse(expense.getId(), expense.getExpenseDate(),
                expense.getCategory(), expense.getDescription(), expense.getAmount());
    }
}
