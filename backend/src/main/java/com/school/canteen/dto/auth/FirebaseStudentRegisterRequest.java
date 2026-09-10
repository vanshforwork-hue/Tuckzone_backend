package com.school.canteen.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Completes registration for a student who already proved their identity through Firebase
 * (phone OTP or email sign-in) — everything {@link StudentRegisterRequest} needs except a
 * password, since Firebase is what verifies this account from now on. See
 * {@link com.school.canteen.auth.firebase.FirebaseAccountService#registerStudent}.
 */
public record FirebaseStudentRegisterRequest(
        @NotBlank String idToken,

        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Email @Size(max = 180) String email,

        @NotBlank
        @Pattern(regexp = ValidationRules.MOBILE_PATTERN, message = ValidationRules.MOBILE_MESSAGE)
        String mobile,

        @NotBlank @Size(max = 40) String admissionNumber,
        @NotBlank @Size(max = 20) String studentClass,
        @NotBlank @Size(max = 10) String section,
        @NotBlank @Size(max = 20) String rollNumber,
        // Holds the student's academic year (e.g. "2025-2026") — field name kept as
        // seatNumber to avoid an entity/column rename; UI-facing label is "Academic Year".
        @NotBlank @Size(max = 20) String seatNumber,

        @Pattern(regexp = ValidationRules.MOBILE_PATTERN, message = ValidationRules.MOBILE_MESSAGE)
        String parentMobile) {
}
