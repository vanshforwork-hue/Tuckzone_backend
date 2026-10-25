package com.school.canteen.billing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PosCategoryRepository extends JpaRepository<PosCategory, UUID> {
    List<PosCategory> findByActiveTrueOrderBySortOrderAscNameAsc();

    boolean existsByActiveTrueAndNameIgnoreCase(String name);

    boolean existsByActiveTrueAndNameIgnoreCaseAndIdNot(String name, UUID id);
}
