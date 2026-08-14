package com.school.canteen.service.impl;

import com.school.canteen.auth.firebase.FirebaseAuthService;
import com.school.canteen.dto.UserSummary;
import com.school.canteen.dto.profile.ProfileUpdateRequest;
import com.school.canteen.entity.StudentProfile;
import com.school.canteen.entity.TeacherProfile;
import com.school.canteen.entity.User;
import com.school.canteen.enums.Role;
import com.school.canteen.enums.UserStatus;
import com.school.canteen.exception.BadRequestException;
import com.school.canteen.exception.ResourceNotFoundException;
import com.school.canteen.mapper.UserMapper;
import com.school.canteen.repository.DeviceTokenRepository;
import com.school.canteen.repository.RefreshTokenRepository;
import com.school.canteen.repository.StudentProfileRepository;
import com.school.canteen.repository.TeacherProfileRepository;
import com.school.canteen.repository.UserRepository;
import com.school.canteen.repository.WardRepository;
import com.school.canteen.service.ProfileService;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileServiceImpl implements ProfileService {

    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final TeacherProfileRepository teacherProfileRepository;
    private final WardRepository wardRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final FirebaseAuthService firebaseAuthService;
    private final UserMapper userMapper;

    public ProfileServiceImpl(UserRepository userRepository,
                              StudentProfileRepository studentProfileRepository,
                              TeacherProfileRepository teacherProfileRepository,
                              WardRepository wardRepository,
                              RefreshTokenRepository refreshTokenRepository,
                              DeviceTokenRepository deviceTokenRepository,
                              FirebaseAuthService firebaseAuthService,
                              UserMapper userMapper) {
        this.userRepository = userRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.teacherProfileRepository = teacherProfileRepository;
        this.wardRepository = wardRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.firebaseAuthService = firebaseAuthService;
        this.userMapper = userMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public UserSummary getProfile(UUID userId) {
        return userMapper.toSummary(findUser(userId));
    }

    @Override
    @Transactional
    public UserSummary updateProfile(UUID userId, ProfileUpdateRequest request) {
        User user = findUser(userId);
        user.setFullName(request.fullName().trim());

        switch (user.getRole()) {
            case STUDENT -> updateStudentFields(userId, request);
            case TEACHER -> updateTeacherFields(userId, request);
            default -> {
                // Parents and admins have no extra profile row to update.
            }
        }
        return userMapper.toSummary(user);
    }

    private void updateStudentFields(UUID userId, ProfileUpdateRequest request) {
        StudentProfile profile = studentProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));

        // Class, section and roll number decide where food is delivered, so they must stay
        // populated rather than being blanked out by a partial form submission.
        requireText(request.studentClass(), "Class is required");
        requireText(request.section(), "Section is required");
        requireText(request.rollNumber(), "Roll number is required");

        profile.setStudentClass(request.studentClass().trim());
        profile.setSection(request.section().trim());
        profile.setRollNumber(request.rollNumber().trim());
        profile.setSeatNumber(blankToNull(request.seatNumber()));
    }

    private void updateTeacherFields(UUID userId, ProfileUpdateRequest request) {
        TeacherProfile profile = teacherProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher profile not found"));
        requireText(request.department(), "Department is required");
        profile.setDepartment(request.department().trim());
    }

    @Override
    @Transactional
    public void deleteAccount(UUID userId) {
        User user = findUser(userId);

        // Orders and wallet transactions reference this user and must survive for
        // accounting/legal retention (see OrderExportController, WalletTransaction) — this
        // anonymizes the identity behind them rather than deleting the User row outright.
        // Order.recipientName already holds a point-in-time copy of who the order was for,
        // so historical order display is unaffected by anonymizing the account itself.
        String uidToRemove = user.getFirebaseUid();
        user.setFullName("Deleted User");
        user.setEmail("deleted-" + userId + "@deleted.tuckzone.invalid");
        user.setMobile("");
        user.setPasswordHash(null);
        user.setFirebaseUid(null);
        user.setStatus(UserStatus.DISABLED);

        refreshTokenRepository.revokeAllForUser(userId, Instant.now());
        deviceTokenRepository.deleteAll(deviceTokenRepository.findByUser_Id(userId));

        // Ward rows are free-text data a parent entered about their child, with no
        // independent retention need once the parent's own account is gone.
        if (user.getRole() == Role.PARENT) {
            wardRepository.deleteAll(wardRepository.findByParent_Id(userId));
        }

        if (uidToRemove != null) {
            firebaseAuthService.deleteUser(uidToRemove);
        }
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private static void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
