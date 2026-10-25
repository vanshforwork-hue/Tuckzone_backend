package com.school.canteen.billing;

import com.school.canteen.billing.PosDtos.AvailabilityRequest;
import com.school.canteen.billing.PosDtos.CatalogResponse;
import com.school.canteen.billing.PosDtos.CategoryRequest;
import com.school.canteen.billing.PosDtos.CategoryResponse;
import com.school.canteen.billing.PosDtos.ItemRequest;
import com.school.canteen.billing.PosDtos.ItemResponse;
import com.school.canteen.billing.PosDtos.SettingsRequest;
import com.school.canteen.billing.PosDtos.SettingsResponse;
import com.school.canteen.exception.BadRequestException;
import com.school.canteen.exception.DuplicateResourceException;
import com.school.canteen.exception.ResourceNotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Catalog (categories + items) and receipt/GST settings. Authorization is on the controller. */
@Service
public class PosCatalogService {

    private final PosCategoryRepository categories;
    private final PosItemRepository items;
    private final PosSettingsRepository settings;

    public PosCatalogService(PosCategoryRepository categories, PosItemRepository items,
                             PosSettingsRepository settings) {
        this.categories = categories;
        this.items = items;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public CatalogResponse catalog() {
        return new CatalogResponse(
                categories.findByActiveTrueOrderBySortOrderAscNameAsc().stream().map(PosCatalogService::toDto).toList(),
                items.findByActiveTrueOrderBySortOrderAscNameAsc().stream().map(PosCatalogService::toDto).toList());
    }

    // ---- categories ----------------------------------------------------------------------

    @Transactional
    public CategoryResponse createCategory(CategoryRequest r) {
        String name = r.name().trim();
        if (name.isEmpty()) {
            throw new BadRequestException("Category name is required.");
        }
        if (categories.existsByActiveTrueAndNameIgnoreCase(name)) {
            throw new DuplicateResourceException("A category named '" + name + "' already exists.");
        }
        PosCategory c = new PosCategory();
        c.setName(name);
        c.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
        return toDto(categories.save(c));
    }

    @Transactional
    public CategoryResponse updateCategory(UUID id, CategoryRequest r) {
        PosCategory c = activeCategory(id);
        String name = r.name().trim();
        if (name.isEmpty()) {
            throw new BadRequestException("Category name is required.");
        }
        if (categories.existsByActiveTrueAndNameIgnoreCaseAndIdNot(name, id)) {
            throw new DuplicateResourceException("A category named '" + name + "' already exists.");
        }
        c.setName(name);
        if (r.sortOrder() != null) {
            c.setSortOrder(r.sortOrder());
        }
        return toDto(c);
    }

    @Transactional
    public void archiveCategory(UUID id) {
        PosCategory c = activeCategory(id);
        if (items.existsByCategoryIdAndActiveTrue(id)) {
            throw new DuplicateResourceException("Remove or move this category's items first.");
        }
        c.setActive(false);
    }

    // ---- items ---------------------------------------------------------------------------

    @Transactional
    public ItemResponse createItem(ItemRequest r) {
        String name = r.name().trim();
        activeCategory(r.categoryId());
        if (name.isEmpty()) {
            throw new BadRequestException("Item name is required.");
        }
        if (items.existsByActiveTrueAndCategoryIdAndNameIgnoreCase(r.categoryId(), name)) {
            throw new DuplicateResourceException("'" + name + "' already exists in this category.");
        }
        PosItem item = new PosItem();
        apply(item, r, name);
        return toDto(items.save(item));
    }

    @Transactional
    public ItemResponse updateItem(UUID id, ItemRequest r) {
        PosItem item = activeItem(id);
        String name = r.name().trim();
        activeCategory(r.categoryId());
        if (name.isEmpty()) {
            throw new BadRequestException("Item name is required.");
        }
        if (items.existsByActiveTrueAndCategoryIdAndNameIgnoreCaseAndIdNot(r.categoryId(), name, id)) {
            throw new DuplicateResourceException("'" + name + "' already exists in this category.");
        }
        apply(item, r, name);
        return toDto(item); // price/name edits never touch pos_bill_items snapshots
    }

    @Transactional
    public ItemResponse setAvailability(UUID id, AvailabilityRequest r) {
        PosItem item = activeItem(id);
        item.setAvailable(r.available());
        return toDto(item);
    }

    /** Retires the item from the counter; issued bills keep their own name/price snapshot. */
    @Transactional
    public void archiveItem(UUID id) {
        activeItem(id).setActive(false);
    }

    // ---- settings ------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public SettingsResponse getSettings() {
        return toDto(settingsRow());
    }

    @Transactional
    public SettingsResponse updateSettings(SettingsRequest r) {
        PosSettings s = settingsRow();
        s.setBusinessName(r.businessName().trim());
        s.setAddress(r.address().trim());
        s.setPhone(r.phone().trim());
        s.setGstin(r.gstin().trim());
        s.setFooterMessage(r.footerMessage().trim());
        s.setCurrencySymbol(r.currencySymbol().trim());
        s.setGstPercent(r.gstPercent());
        s.setGstEnabledDefault(r.gstEnabledDefault());
        return toDto(s);
    }

    PosSettings settingsRow() {
        return settings.findById(PosSettings.SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("pos_settings singleton row is missing"));
    }

    // ---- helpers -------------------------------------------------------------------------

    private PosCategory activeCategory(UUID id) {
        return categories.findById(id).filter(PosCategory::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found."));
    }

    private PosItem activeItem(UUID id) {
        return items.findById(id).filter(PosItem::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found."));
    }

    private static void apply(PosItem item, ItemRequest r, String name) {
        item.setCategoryId(r.categoryId());
        item.setName(name);
        item.setPrice(r.price());
        item.setEmoji(r.emoji() == null ? "" : r.emoji().trim());
        if (r.available() != null) {
            item.setAvailable(r.available());
        }
        if (r.favorite() != null) {
            item.setFavorite(r.favorite());
        }
        if (r.sortOrder() != null) {
            item.setSortOrder(r.sortOrder());
        }
    }

    private static CategoryResponse toDto(PosCategory c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getSortOrder());
    }

    private static ItemResponse toDto(PosItem i) {
        return new ItemResponse(i.getId(), i.getCategoryId(), i.getName(), i.getPrice(), i.getEmoji(),
                i.isAvailable(), i.isFavorite(), i.getSortOrder());
    }

    private static SettingsResponse toDto(PosSettings s) {
        return new SettingsResponse(s.getBusinessName(), s.getAddress(), s.getPhone(), s.getGstin(),
                s.getFooterMessage(), s.getCurrencySymbol(), s.getGstPercent(), s.isGstEnabledDefault());
    }
}
