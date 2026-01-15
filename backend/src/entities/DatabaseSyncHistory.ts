/**
 * DatabaseSyncHistory Entity
 * Tracks database sync operations for auditing
 */
import { Entity, Property, ManyToOne, Ref, Enum, Index } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { DatabaseInstance } from './DatabaseInstance';
import { User } from './User';

export enum SyncType {
    MANUAL = 'manual',
    SCHEDULED = 'scheduled',
    STARTUP = 'startup',
}

export enum SyncStatus {
    SUCCESS = 'success',
    PARTIAL = 'partial',
    FAILED = 'failed',
}

@Entity({ tableName: 'database_sync_history' })
@Index({ properties: ['createdAt'] })
export class DatabaseSyncHistory extends IntBaseEntity {
    @ManyToOne(() => DatabaseInstance, { deleteRule: 'cascade', ref: true })
    @Index()
    instance!: Ref<DatabaseInstance>;

    @Enum({ items: () => SyncType })
    syncType!: SyncType;

    @Enum({ items: () => SyncStatus })
    status!: SyncStatus;

    @Property({ type: 'integer', default: 0 })
    databasesFound: number = 0;

    @Property({ type: 'integer', default: 0 })
    databasesAdded: number = 0;

    @Property({ type: 'integer', default: 0 })
    databasesRemoved: number = 0;

    @Property({ type: 'text', nullable: true })
    errorMessage?: string;

    @Property({ type: 'integer', nullable: true })
    durationMs?: number;

    @ManyToOne(() => User, { nullable: true, ref: true })
    triggeredBy?: Ref<User>;
}
