package com.school.canteen.service;

import com.school.canteen.dto.UserSummary;
import com.school.canteen.dto.profile.ProfileUpdateRequest;
import java.util.UUID;

/** A user viewing and editing their own profile. */
public interface ProfileService {

    UserSummary getProfile(UUID userId);

    UserSummary updateProfile(UUID userId, ProfileUpdateRequest request);

    /** Anonymizes and disables the account per the user's own request. Order and wallet
     *  history are kept (with the account now anonymous) for accounting/legal retention. */
    void deleteAccount(UUID userId);
}
