/**
 * QueryRequest Entity
 * Represents a database query/script submission request
 */
import { Entity, Property, Enum, ManyToOne, Index, TextType, Ref, ref } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { User } from './User';

/**
 * Request status enum
 */
export enum RequestStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    EXECUTING = 'executing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

/**
 * Submission type enum
 */
export enum SubmissionType {
    QUERY = 'query',
    SCRIPT = 'script',
}

/**
 * Database type enum
 */
export enum DatabaseType {
    POSTGRESQL = 'postgresql',
    MONGODB = 'mongodb',
}

@Entity({ tableName: 'query_requests' })
export class QueryRequest extends IntBaseEntity {
    // UUID for external reference (in addition to internal id)
    @Property({ type: 'uuid', unique: true, onCreate: () => crypto.randomUUID() })
    uuid: string = crypto.randomUUID();

    // Index creation time for fast range queries and sorting
    @Property({ type: 'timestamptz' })
    @Index()
    createdAt: Date = new Date();

    // User who submitted the request
    @ManyToOne(() => User, { deleteRule: 'restrict', ref: true })
    @Index()
    user!: Ref<User>;

    @Enum({ items: () => DatabaseType })
    databaseType!: DatabaseType;

    @Property({ type: 'varchar', length: 100 })
    instanceId!: string;

    @Property({ type: 'varchar', length: 255 })
    instanceName!: string;

    @Property({ type: 'varchar', length: 255 })
    databaseName!: string;

    @Enum({ items: () => SubmissionType })
    submissionType!: SubmissionType;

    @Property({ type: TextType, nullable: true })
    queryContent?: string;

    @Property({ type: 'varchar', length: 255, nullable: true })
    scriptFilename?: string;

    @Property({ type: TextType, nullable: true })
    scriptContent?: string;

    @Property({ type: TextType })
    comments!: string;

    @Property({ type: 'varchar', length: 50 })
    @Index()
    podId!: string;

    @Property({ type: 'varchar', length: 100 })
    podName!: string;

    @Enum({ items: () => RequestStatus, default: RequestStatus.PENDING })
    @Index()
    status: RequestStatus = RequestStatus.PENDING;

    // Approver info
    @ManyToOne(() => User, { nullable: true, deleteRule: 'set null', ref: true })
    approver?: Ref<User>;

    @Property({ type: 'varchar', length: 255, nullable: true })
    approverEmail?: string;

    @Property({ type: 'timestamptz', nullable: true })
    approvedAt?: Date;

    @Property({ type: TextType, nullable: true })
    rejectionReason?: string;

    // Execution info
    @Property({ type: TextType, nullable: true })
    executionResult?: string;

    @Property({ type: TextType, nullable: true })
    executionError?: string;

    @Property({ type: 'timestamptz', nullable: true })
    executionStartedAt?: Date;

    @Property({ type: 'timestamptz', nullable: true })
    executionCompletedAt?: Date;

    /**
     * Check if request can be approved
     */
    canBeApproved(): boolean {
        return this.status === RequestStatus.PENDING;
    }

    /**
     * Check if request can be rejected
     */
    canBeRejected(): boolean {
        return this.status === RequestStatus.PENDING;
    }

    /**
     * Check if request is terminal (completed or failed)
     */
    isTerminal(): boolean {
        return [RequestStatus.COMPLETED, RequestStatus.FAILED, RequestStatus.REJECTED].includes(this.status);
    }

    /**
     * Approve the request
     */
    approve(approver: User): void {
        if (!this.canBeApproved()) {
            throw new Error(`Request cannot be approved in ${this.status} status`);
        }
        this.status = RequestStatus.APPROVED;
        this.approver = ref(approver);
        this.approverEmail = approver.email;
        this.approvedAt = new Date();
    }

    /**
     * Reject the request
     */
    reject(approver: User, reason?: string): void {
        if (!this.canBeRejected()) {
            throw new Error(`Request cannot be rejected in ${this.status} status`);
        }
        this.status = RequestStatus.REJECTED;
        this.approver = ref(approver);
        this.approverEmail = approver.email;
        this.rejectionReason = reason;
    }

    /**
     * Mark as executing
     */
    markExecuting(): void {
        this.status = RequestStatus.EXECUTING;
        this.executionStartedAt = new Date();
    }

    /**
     * Mark as completed
     */
    markCompleted(result: string): void {
        this.status = RequestStatus.COMPLETED;
        this.executionResult = result;
        this.executionCompletedAt = new Date();
    }

    /**
     * Mark as failed
     */
    markFailed(error: string): void {
        this.status = RequestStatus.FAILED;
        this.executionError = error;
        this.executionCompletedAt = new Date();
    }
}
