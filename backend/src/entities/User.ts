/**
 * User Entity
 * Represents a user in the system with role-based access
 */
import { Entity, Property, Enum, OneToMany, Collection, Unique, Index } from '@mikro-orm/core';
import { UuidBaseEntity } from './BaseEntity';
import type { QueryRequest } from './QueryRequest';
import type { RefreshToken } from './RefreshToken';

/**
 * User roles enum
 */
export enum UserRole {
    DEVELOPER = 'developer',
    MANAGER = 'manager',
    ADMIN = 'admin',
}

@Entity({ tableName: 'users' })
export class User extends UuidBaseEntity {
    @Property({ type: 'varchar', length: 255 })
    @Unique()
    @Index()
    email!: string;

    @Property({ type: 'varchar', length: 255 })
    passwordHash!: string;

    @Property({ type: 'varchar', length: 255 })
    name!: string;

    @Enum({ items: () => UserRole, default: UserRole.DEVELOPER })
    @Index()
    role: UserRole = UserRole.DEVELOPER;

    @Property({ type: 'varchar', length: 50, nullable: true })
    @Index()
    podId?: string;

    @Property({ type: 'varchar', length: 50, nullable: true })
    slackUserId?: string;

    @Property({ type: 'boolean', default: true })
    isActive: boolean = true;

    @Property({ type: 'timestamptz', nullable: true })
    lastLogin?: Date;

    // Relations - using string refs with proper types
    @OneToMany('QueryRequest', 'user')
    queryRequests = new Collection<QueryRequest>(this);

    @OneToMany('QueryRequest', 'approver')
    approvedRequests = new Collection<QueryRequest>(this);

    @OneToMany('RefreshToken', 'user')
    refreshTokens = new Collection<RefreshToken>(this);

    /**
     * Helper to check if user can approve requests for a pod
     */
    canApproveForPod(podId: string): boolean {
        if (this.role === UserRole.ADMIN) return true;
        if (this.role === UserRole.MANAGER && this.podId === podId) return true;
        return false;
    }
}
