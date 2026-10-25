package com.school.canteen.billing;

import com.school.canteen.enums.Role;
import com.school.canteen.security.AppUserDetails;
import java.util.UUID;

/** Who is calling, reduced to what the billing scope rules need. */
public record PosActor(UUID id, boolean admin) {

    public static PosActor of(AppUserDetails principal) {
        return new PosActor(principal.getUser().getId(), principal.getUser().getRole() == Role.CANTEEN_ADMIN);
    }
}
