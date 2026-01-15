/**
 * RefreshToken Entity
 * Represents a refresh token session for authentication
 *
 * TOKEN FAMILY ARCHITECTURE:
 * This entity implements the "Token Family" pattern for enhanced security.
 * Each login creates a new "family" of tokens. When a token is refreshed,
 * a new token in the same family is issued. If a used token is presented
 * again (replay attack), the entire family is revoked.
 *
 * SECURITY FEATURES:
 * - familyId: Groups tokens from the same login session
 * - isUsed: Marks tokens that have been exchanged (honeytoken trap)
 * - ipAddress: Binds tokens to the creation IP for mismatch detection
 * - isRevoked: Hard revocation flag for compromised tokens
 *
 * ATTACK SCENARIOS HANDLED:
 * 1. Token theft + use before victim: Victim's next refresh detects reuse
 * 2. Token theft + use after victim: Thief's use triggers reuse detection
 * 3. Token from different IP: IP mismatch triggers revocation
 */
import { Entity, Property, ManyToOne, Index, Ref, ref } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { User } from './User';

@Entity({ tableName: 'refresh_tokens' })
export class RefreshToken extends IntBaseEntity {
    // =========================================================================
    // Relationships
    // =========================================================================

    @ManyToOne(() => User, { deleteRule: 'cascade', ref: true })
    @Index()
    user!: Ref<User>;

    // =========================================================================
    // Token Identification
    // =========================================================================

    /**
     * SHA-256 hash of the refresh token
     * We store the hash, not the raw token, for security
     */
    @Property({ type: 'varchar', length: 255 })
    @Index()
    tokenHash!: string;

    // =========================================================================
    // Token Family (Security Chain)
    // =========================================================================

    /**
     * Family ID - Groups tokens from the same login session
     *
     * WHY: When token theft is detected (via isUsed reuse), we revoke
     * ALL tokens in the family, not just one. This ensures both the
     * attacker and victim are kicked out, forcing a fresh login.
     *
     * LIFECYCLE:
     * - Created on login (new UUID)
     * - Inherited on refresh (same familyId passed to new token)
     * - Used to revoke entire session chain on reuse detection
     */
    @Property({ type: 'uuid' })
    @Index()
    familyId!: string;

    /**
     * Is Used - Marks if this token has been exchanged for a new one
     *
     * WHY: This is the core of the "Honeytoken Trap" pattern.
     * A refresh token should only be used ONCE. If it's presented again,
     * it means either:
     * 1. The user's token was stolen and the thief used it first
     * 2. The thief's stolen token is being replayed
     *
     * Either way, the session is compromised and must be terminated.
     */
    @Property({ type: 'boolean', default: false })
    isUsed: boolean = false;

    // =========================================================================
    // Device Fingerprinting
    // =========================================================================

    /**
     * Device information for session identification
     * Typically the User-Agent header
     */
    @Property({ type: 'varchar', length: 255, nullable: true })
    deviceInfo?: string;

    /**
     * IP Address where the token was created
     *
     * SECURITY: Used for optional IP binding. If enforced, tokens
     * can only be refreshed from the same IP they were created on.
     * This prevents tokens from being used if stolen and accessed
     * from a different location.
     */
    @Property({ type: 'varchar', length: 50, nullable: true })
    ipAddress?: string;

    // =========================================================================
    // Revocation State
    // =========================================================================

    /**
     * Whether this token has been explicitly revoked
     */
    @Property({ type: 'boolean', default: false })
    isRevoked: boolean = false;

    /**
     * Timestamp when the token was revoked (for audit trail)
     */
    @Property({ type: 'timestamptz', nullable: true })
    revokedAt?: Date;

    // =========================================================================
    // Expiration
    // =========================================================================

    /**
     * When this token expires (typically 7 days from creation)
     */
    @Property({ type: 'timestamptz' })
    expiresAt!: Date;

    // =========================================================================
    // Helper Methods
    // =========================================================================

    /**
     * Check if token is valid for use
     *
     * A token is valid if:
     * - Not revoked
     * - Not expired
     * - Not already used (for Token Family pattern)
     */
    isValid(): boolean {
        return !this.isRevoked && !this.isUsed && this.expiresAt > new Date();
    }

    /**
     * Check if this token can be refreshed (less strict than isValid)
     * Used during the refresh process before the reuse check
     */
    canBeRefreshed(): boolean {
        return !this.isRevoked && this.expiresAt > new Date();
    }

    /**
     * Mark this token as used (part of token rotation)
     */
    markAsUsed(): void {
        this.isUsed = true;
    }

    /**
     * Revoke this token
     */
    revoke(): void {
        this.isRevoked = true;
        this.revokedAt = new Date();
    }
}
