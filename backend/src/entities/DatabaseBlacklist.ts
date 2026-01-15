/**
 * DatabaseBlacklist Entity
 * Stores patterns for databases to exclude from sync
 */
import { Entity, Property, ManyToOne, Ref, Enum, Index } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { User } from './User';

export enum PatternType {
    EXACT = 'exact',
    PREFIX = 'prefix',
    REGEX = 'regex',
}

@Entity({ tableName: 'database_blacklist' })
export class DatabaseBlacklist extends IntBaseEntity {
    @Property({ type: 'varchar', length: 255 })
    @Index()
    pattern!: string;

    @Enum({ items: () => PatternType, default: PatternType.EXACT })
    patternType: PatternType = PatternType.EXACT;

    @Property({ type: 'text', nullable: true })
    reason?: string;

    @ManyToOne(() => User, { nullable: true, ref: true })
    createdBy?: Ref<User>;
}
