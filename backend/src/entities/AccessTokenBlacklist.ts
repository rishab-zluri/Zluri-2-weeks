/**
 * AccessTokenBlacklist Entity
 * Stores blacklisted access tokens (logged out tokens)
 */
import { Entity, Property, ManyToOne, Index, Ref, ref } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { User } from './User';

@Entity({ tableName: 'access_token_blacklist' })
export class AccessTokenBlacklist extends IntBaseEntity {
    @Property({ type: 'varchar', length: 64, unique: true })
    @Index()
    tokenHash!: string;

    @ManyToOne(() => User, { deleteRule: 'cascade', ref: true })
    @Index()
    user!: Ref<User>;

    @Property({ type: 'timestamptz' })
    @Index()
    expiresAt!: Date;

    @Property({ type: 'timestamptz', nullable: true, defaultRaw: 'CURRENT_TIMESTAMP' })
    revokedAt?: Date = new Date();

    @Property({ type: 'varchar', length: 50, default: 'logout' })
    reason: string = 'logout';
}
