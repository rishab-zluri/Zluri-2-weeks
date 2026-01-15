/**
 * Base Entities
 * Provides common fields and primary key strategies
 */
import { Property, PrimaryKey } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract Base Entity with timestamps
 */
export abstract class BaseEntity {
    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    createdAt: Date = new Date();

    @Property({ type: 'timestamptz', onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}

/**
 * Base Entity with UUID Primary Key
 * Used by: Users
 */
export abstract class UuidBaseEntity extends BaseEntity {
    @PrimaryKey({ type: 'uuid' })
    id: string = uuidv4();
}

/**
 * Base Entity with Integer (Serial) Primary Key
 * Used by: RefreshTokens, Databases, etc.
 */
export abstract class IntBaseEntity extends BaseEntity {
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;
}
