package com.school.canteen.billing;

import com.school.canteen.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A parked cart: item ids and quantities only; it is re-priced from the live catalog on resume. */
@Entity
@Table(name = "pos_held_carts")
public class PosHeldCart extends BaseEntity {

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "label", nullable = false)
    private String label = "";

    /** JSON array of {itemId, quantity}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lines", nullable = false, columnDefinition = "jsonb")
    private String lines;

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getLines() { return lines; }
    public void setLines(String lines) { this.lines = lines; }
}
