package com.school.canteen.billing;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PosBillItemRepository extends JpaRepository<PosBillItem, UUID> {
    List<PosBillItem> findByBillIdInOrderByCreatedAtAsc(Collection<UUID> billIds);
}
