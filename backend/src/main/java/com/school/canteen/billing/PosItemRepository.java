package com.school.canteen.billing;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosItemRepository extends JpaRepository<PosItem, UUID> {
    List<PosItem> findByActiveTrueOrderBySortOrderAscNameAsc();

    boolean existsByCategoryIdAndActiveTrue(UUID categoryId);

    boolean existsByActiveTrueAndCategoryIdAndNameIgnoreCase(UUID categoryId, String name);

    boolean existsByActiveTrueAndCategoryIdAndNameIgnoreCaseAndIdNot(UUID categoryId, String name, UUID id);

    /** Row-locked read so a concurrent price edit cannot slip between pricing and insert. */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select i from PosItem i where i.id in :ids")
    List<PosItem> lockAllById(@Param("ids") Collection<UUID> ids);
}
