/**
 * Pod Entity
 * Represents a team/pod configuration for approval routing
 */
import { Entity, Property, PrimaryKey } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';

@Entity({ tableName: 'pods' })
export class Pod extends BaseEntity {
    @PrimaryKey({ type: 'varchar', length: 50 })
    id!: string;

    @Property({ type: 'varchar', length: 100 })
    name!: string;

    @Property({ type: 'varchar', length: 255 })
    managerEmail!: string;

    @Property({ type: 'text', nullable: true })
    description?: string;

    @Property({ type: 'boolean', default: true })
    isActive: boolean = true;
}
