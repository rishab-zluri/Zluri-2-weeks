/**
 * Database Entity
 * Represents a database within an instance
 */
import { Entity, Property, ManyToOne, Index, Unique, Ref } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { DatabaseInstance } from './DatabaseInstance';

@Entity({ tableName: 'databases' })
@Unique({ properties: ['instance', 'name'] })
export class Database extends IntBaseEntity {
    @ManyToOne(() => DatabaseInstance, { deleteRule: 'cascade', ref: true })
    @Index()
    instance!: Ref<DatabaseInstance>;

    @Property({ type: 'varchar', length: 255 })
    @Index()
    name!: string;

    @Property({ type: 'text', nullable: true })
    description?: string;

    @Property({ type: 'varchar', length: 50, default: 'synced' })
    source: string = 'synced';

    @Property({ type: 'boolean', default: true })
    isActive: boolean = true;

    @Property({ type: 'timestamptz', nullable: true })
    lastSeenAt?: Date;
}
