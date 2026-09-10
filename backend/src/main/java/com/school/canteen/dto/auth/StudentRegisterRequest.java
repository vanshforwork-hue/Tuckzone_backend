package com.school.canteen.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Self-registration payload for a student. Validation here is the first gate; uniqueness
 * (email, mobile, admission number) is enforced authoritatively by the database.
 */
public record StudentRegisterRequest(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Email @Size(max = 180) String email,

        @NotBlank
        @Pattern(regexp = ValidationRules.MOBILE_PATTERN, message = ValidationRules.MOBILE_MESSAGE)
        String mobile,

        @NotBlank
        @Size(min = ValidationRules.PASSWORD_MIN, max = ValidationRules.PASSWORD_MAX,
                message = ValidationRules.PASSWORD_MESSAGE)
        String password,

        @NotBlank @Size(max = 40) String admissionNumber,
        @NotBlank @Size(max = 20) String studentClass,
        @NotBlank @Size(max = 10) String section,
        @NotBlank @Size(max = 20) String rollNumber,
        // Holds the student's academic year (e.g. "2025-2026") — field name kept as
        // seatNumber to avoid an entity/column rename; UI-facing label is "Academic Year".
        @NotBlank @Size(max = 20) String seatNumber,

        /**
         * The number a parent must quote to link this student to their account. Optional at
         * registration — a student without it simply can't be linked until one is added later
         * — but validated against the same pattern whenever it is supplied (null bypasses
         * {@code @Pattern} by spec; only a non-blank value is checked).
         */
        @Pattern(regexp = ValidationRules.MOBILE_PATTERN, message = ValidationRules.MOBILE_MESSAGE)
        String parentMobile) {
}
