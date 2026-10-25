package com.school.canteen.billing;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosBillRepository extends JpaRepository<PosBill, UUID> {
    Optional<PosBill> findByCreatedByAndIdempotencyKey(UUID createdBy, String idempotencyKey);

    /**
     * Filtered history. {@code creator} null = all creators (admin); non-null scopes to
     * one account (sub admin). {@code q} (empty = no filter) matches the invoice number.
     */
    @Query("""
            select b from PosBill b
            where b.billDate between :from and :to
              and (:creator is null or b.createdBy = :creator)
              and (:status is null or b.status = :status)
              and (:q = '' or lower(b.invoiceNumber) like lower(concat('%', :q, '%')))
            order by b.createdAt desc
            """)
    Page<PosBill> search(@Param("from") LocalDate from, @Param("to") LocalDate to,
                         @Param("creator") UUID creator, @Param("status") PosBill.Status status,
                         @Param("q") String q, Pageable pageable);

    @Query("select b from PosBill b where b.status = 'COMPLETED' and b.billDate between :from and :to order by b.createdAt")
    List<PosBill> completedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select b from PosBill b where b.status = 'VOID' and b.billDate between :from and :to order by b.createdAt")
    List<PosBill> voidedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
