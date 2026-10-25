package com.school.canteen.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Security wiring for a stateless JWT API.
 *
 * @EnableMethodSecurity turns on @PreAuthorize so endpoints can require a role
 * (e.g. @PreAuthorize("hasRole('SCHOOL_ADMIN')")).
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          CorsConfigurationSource corsConfigurationSource) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        // Public: launch-screen config plus the generated API docs used to build the
                        // mobile client. Neither exposes any user data.
                        .requestMatchers("/api/health/**", "/api/auth/**", "/api/config/**",
                                "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // Public: called server-to-server by the payment provider, never by a
                        // browser/app — there is no JWT to present. Authenticity comes entirely
                        // from the provider signature verified inside PaymentService.handleWebhook,
                        // not from Spring Security.
                        .requestMatchers("/api/payments/webhooks/**").permitAll()
                        // Public, GET only: a plain <img src> tag can never present this app's
                        // bearer token (it's not cookie-based auth), and a food photo isn't
                        // sensitive enough to need a signed-URL scheme instead. Uploading one
                        // still requires CANTEEN_ADMIN/SUB_ADMIN — see MenuItemAdminController.
                        .requestMatchers(HttpMethod.GET, "/api/menu-items/*/image").permitAll()
                        // Counter billing: staff only, enforced here (before request parsing/validation)
                        // as well as per-method in PosController, which narrows it further.
                        .requestMatchers("/api/admin/billing/**").hasAnyRole("CANTEEN_ADMIN", "SUB_ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * BCrypt is deliberately slow and salts every hash. Exposed as the PasswordEncoder
     * interface so callers never depend on the concrete algorithm.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
