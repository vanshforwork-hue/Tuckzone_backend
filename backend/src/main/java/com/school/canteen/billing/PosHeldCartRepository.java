package com.school.canteen.billing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PosHeldCartRepository extends JpaRepository<PosHeldCart, UUID> {
    List<PosHeldCart> findByCreatedByOrderByCreatedAtDesc(UUID createdBy);
}
