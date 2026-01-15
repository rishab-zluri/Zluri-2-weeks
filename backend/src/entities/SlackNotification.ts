/**
 * SlackNotification Entity
 * Tracks all Slack notifications sent by the system
 */
import { Entity, Property, ManyToOne, Ref, Enum, Index } from '@mikro-orm/core';
import { IntBaseEntity } from './BaseEntity';
import { QueryRequest } from './QueryRequest';

export enum NotificationType {
    NEW_SUBMISSION = 'new_submission',
    APPROVAL = 'approval',
    REJECTION = 'rejection',
    EXECUTION_SUCCESS = 'execution_success',
    EXECUTION_FAILURE = 'execution_failure',
}

export enum ChannelType {
    CHANNEL = 'channel',
    DM = 'dm',
}

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

@Entity({ tableName: 'slack_notifications' })
export class SlackNotification extends IntBaseEntity {
    @ManyToOne(() => QueryRequest, { deleteRule: 'cascade', ref: true })
    @Index()
    request!: Ref<QueryRequest>;

    @Enum({ items: () => NotificationType })
    notificationType!: NotificationType;

    @Enum({ items: () => ChannelType })
    channelType!: ChannelType;

    @Property({ type: 'varchar', length: 255 })
    recipient!: string;

    @Property({ type: 'varchar', length: 50, nullable: true })
    messageTs?: string;

    @Enum({ items: () => NotificationStatus, default: NotificationStatus.PENDING })
    @Index()
    status: NotificationStatus = NotificationStatus.PENDING;

    @Property({ type: 'text', nullable: true })
    errorMessage?: string;

    @Property({ type: 'timestamptz', nullable: true })
    sentAt?: Date;
}
