package com.school.canteen.billing;

import com.school.canteen.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Counter-billing category. Retired (active=false) rather than deleted. */
@Entity
@Table(name = "pos_categories")
public class PosCategory extends BaseEntity {

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
