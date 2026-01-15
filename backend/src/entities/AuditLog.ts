/**
 * AuditLog Entity
 * Maintains comprehensive audit trail of system actions
 */
import { Entity, Property, ManyToOne, Ref, Index } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { User } from './User';

@Entity({ tableName: 'audit_logs' })
@Index({ properties: ['entityType', 'entityId'] })
@Index({ properties: ['createdAt'] })
export class AuditLog extends IntBaseEntity {
    @ManyToOne(() => User, { nullable: true, deleteRule: 'set null', ref: true })
    @Index()
    user?: Ref<User>;

    @Property({ type: 'varchar', length: 50 })
    action!: string;

    @Property({ type: 'varchar', length: 50 })
    entityType!: string;

    @Property({ type: 'varchar', length: 100, nullable: true })
    entityId?: string;

    @Property({ type: 'jsonb', nullable: true })
    oldValues?: any;

    @Property({ type: 'jsonb', nullable: true })
    newValues?: any;

    @Property({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string;

    @Property({ type: 'text', nullable: true })
    userAgent?: string;
}
