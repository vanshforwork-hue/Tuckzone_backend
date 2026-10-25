package com.school.canteen.billing;

import com.school.canteen.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/** Immutable line snapshot: name and price are copied at sale time. */
@Entity
@Table(name = "pos_bill_items")
public class PosBillItem extends BaseEntity {

    @Column(name = "bill_id", nullable = false, updatable = false)
    private UUID billId;

    @Column(name = "item_id", updatable = false)
    private UUID itemId;

    @Column(name = "item_name", nullable = false, updatable = false)
    private String itemName;

    @Column(name = "emoji", nullable = false, updatable = false)
    private String emoji;

    @Column(name = "unit_price", nullable = false, updatable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "quantity", nullable = false, updatable = false)
    private int quantity;

    @Column(name = "line_total", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;

    protected PosBillItem() {
    }

    public PosBillItem(UUID billId, PosItem item, int quantity) {
        this.billId = billId;
        this.itemId = item.getId();
        this.itemName = item.getName();
        this.emoji = item.getEmoji();
        this.unitPrice = item.getPrice();
        this.quantity = quantity;
        this.lineTotal = item.getPrice().multiply(BigDecimal.valueOf(quantity));
    }

    public UUID getBillId() { return billId; }
    public UUID getItemId() { return itemId; }
    public String getItemName() { return itemName; }
    public String getEmoji() { return emoji; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public int getQuantity() { return quantity; }
    public BigDecimal getLineTotal() { return lineTotal; }
}
