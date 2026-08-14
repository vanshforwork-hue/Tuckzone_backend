package com.school.canteen.auth.firebase;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.school.canteen.config.FirebaseAdminConfig;
import com.school.canteen.exception.InvalidFirebaseTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The ONLY place in the codebase that talks to the Firebase Admin SDK for authentication
 * (FCM push has its own, separate sender). Everything downstream of this class works with
 * {@link FirebaseVerifiedIdentity}, never with a raw ID token or the SDK's own types — that
 * boundary is what would let Firebase be swapped for another provider later without
 * touching {@code AuthController}, {@code FirebaseAccountService}, or the DTOs.
 *
 * Trust boundary: a token is never accepted on the strength of anything the client claims
 * about it (uid, email, phone) — {@link #verify} is the single choke point where the
 * signature, issuer, audience, and expiry are actually checked, server-side, against
 * Google's public keys via the Admin SDK.
 */
@Service
public class FirebaseAuthService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthService.class);

    private final FirebaseAdminConfig firebaseAdminConfig;

    public FirebaseAuthService(FirebaseAdminConfig firebaseAdminConfig) {
        this.firebaseAdminConfig = firebaseAdminConfig;
    }

    /**
     * Verifies a Firebase ID token and returns what it proves. Throws
     * {@link InvalidFirebaseTokenException} for anything wrong with the token itself
     * (expired, revoked, wrong project, malformed) — the SDK-level detail is logged but
     * never handed to the caller.
     */
    public FirebaseVerifiedIdentity verify(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new InvalidFirebaseTokenException();
        }
        try {
            // checkRevoked=true costs an extra network round-trip per verification (the SDK
            // must check the user's tokensValidAfterTime against Firebase's servers rather
            // than validating the JWT signature alone) but is what makes "disable this
            // account" or "the user changed their password elsewhere" actually take effect
            // immediately, instead of waiting out the token's ~1 hour natural expiry.
            FirebaseToken decoded = FirebaseAuth.getInstance(firebaseAdminConfig.get()).verifyIdToken(idToken, true);
            Object emailVerifiedClaim = decoded.getClaims().get("email_verified");
            boolean emailVerified = Boolean.TRUE.equals(emailVerifiedClaim);
            Object phoneNumber = decoded.getClaims().get("phone_number");
            return new FirebaseVerifiedIdentity(
                    decoded.getUid(),
                    decoded.getEmail(),
                    emailVerified,
                    phoneNumber == null ? null : phoneNumber.toString());
        } catch (FirebaseAuthException ex) {
            log.warn("Firebase ID token verification failed: {}", ex.getAuthErrorCode(), ex);
            throw new InvalidFirebaseTokenException();
        }
    }

    /**
     * Best-effort: removes the Firebase identity itself as part of account deletion.
     * Callers must not let this fail the surrounding transaction — an environment with no
     * Firebase credentials configured (see {@link FirebaseAdminConfig}) must still be able
     * to delete the local account, and a user who signed up before Firebase was wired up
     * has no Firebase identity to remove at all.
     */
    public void deleteUser(String uid) {
        try {
            FirebaseAuth.getInstance(firebaseAdminConfig.get()).deleteUser(uid);
        } catch (FirebaseAuthException ex) {
            log.warn("Could not delete Firebase user {}: {}", uid, ex.getAuthErrorCode(), ex);
        } catch (IllegalStateException ex) {
            // Firebase credentials aren't configured in this environment — see
            // FirebaseAdminConfig#get. Nothing to clean up on Firebase's side in that case.
            log.info("Firebase not configured; skipping remote deletion for uid {}", uid);
        }
    }
}
