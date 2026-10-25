package com.school.canteen.billing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.UpdateTimestamp;

/** The single settings row (id = 1): receipt header and GST configuration. */
@Entity
@Table(name = "pos_settings")
public class PosSettings {

    public static final short SINGLETON_ID = 1;

    @Id
    @Column(name = "id")
    private short id = SINGLETON_ID;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(name = "address", nullable = false)
    private String address;

    @Column(name = "phone", nullable = false)
    private String phone;

    @Column(name = "gstin", nullable = false)
    private String gstin;

    @Column(name = "footer_message", nullable = false)
    private String footerMessage;

    @Column(name = "currency_symbol", nullable = false)
    private String currencySymbol;

    @Column(name = "gst_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal gstPercent;

    @Column(name = "gst_enabled_default", nullable = false)
    private boolean gstEnabledDefault;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public String getBusinessName() { return businessName; }
    public void setBusinessName(String v) { this.businessName = v; }
    public String getAddress() { return address; }
    public void setAddress(String v) { this.address = v; }
    public String getPhone() { return phone; }
    public void setPhone(String v) { this.phone = v; }
    public String getGstin() { return gstin; }
    public void setGstin(String v) { this.gstin = v; }
    public String getFooterMessage() { return footerMessage; }
    public void setFooterMessage(String v) { this.footerMessage = v; }
    public String getCurrencySymbol() { return currencySymbol; }
    public void setCurrencySymbol(String v) { this.currencySymbol = v; }
    public BigDecimal getGstPercent() { return gstPercent; }
    public void setGstPercent(BigDecimal v) { this.gstPercent = v; }
    public boolean isGstEnabledDefault() { return gstEnabledDefault; }
    public void setGstEnabledDefault(boolean v) { this.gstEnabledDefault = v; }
}
