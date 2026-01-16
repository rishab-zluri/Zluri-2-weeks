/**
 * UserTokenInvalidation Entity
 * Tracks when a user's tokens are globally invalidated (e.g., "logout from all devices")
 *
 * WHY THIS EXISTS:
 * When a user logs out from all devices, we need to invalidate ALL their access tokens.
 * Since access tokens are stateless JWTs, we can't revoke them directly.
 * Instead, we record the invalidation timestamp and check it during token verification.
 *
 * HOW IT WORKS:
 * 1. User calls "logout all" → new row inserted with current timestamp
 * 2. On subsequent requests, auth middleware checks if token.iat < invalidated_at
 * 3. If true, the token was issued before the invalidation → reject it
 */
import { Entity, Property, ManyToOne, Ref, Index } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { User } from './User';

@Entity({ tableName: 'user_token_invalidation' })
export class UserTokenInvalidation extends IntBaseEntity {
    @ManyToOne(() => User, { deleteRule: 'cascade', ref: true })
    @Index()
    user!: Ref<User>;

    /**
     * Timestamp when all user tokens were invalidated
     * Tokens issued before this timestamp are considered invalid
     */
    @Property({ type: 'timestamptz', defaultRaw: 'CURRENT_TIMESTAMP' })
    @Index()
    invalidatedAt: Date = new Date();
}
