/**
 * DatabaseInstance Entity
 * Represents a database instance (PostgreSQL or MongoDB server)
 */
import { Entity, Property, Enum, OneToMany, Collection, Index, PrimaryKey } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { DatabaseType } from './QueryRequest';
import type { Database } from './Database';

@Entity({ tableName: 'database_instances' })
export class DatabaseInstance extends BaseEntity {
    @PrimaryKey({ type: 'varchar', length: 100 })
    id!: string;

    @Property({ type: 'varchar', length: 255 })
    @Index()
    name!: string;

    @Enum({ items: () => DatabaseType })
    type!: DatabaseType;

    @Property({ type: 'varchar', length: 255 })
    host!: string;

    @Property({ type: 'int' })
    port!: number;

    @Property({ type: 'varchar', length: 100, nullable: true })
    credentialsEnvPrefix?: string;

    @Property({ type: 'varchar', length: 100, nullable: true })
    connectionStringEnv?: string;

    @Property({ type: 'text', nullable: true })
    description?: string;

    @Property({ type: 'boolean', default: true })
    isActive: boolean = true;

    @Property({ type: 'timestamptz', nullable: true })
    lastSyncAt?: Date;

    @Property({ type: 'varchar', length: 50, nullable: true })
    lastSyncStatus?: string;

    @Property({ type: 'text', nullable: true })
    lastSyncError?: string;

    // Relations - using string ref with proper type import
    @OneToMany('Database', 'instance')
    databases = new Collection<Database>(this);
}
