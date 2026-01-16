import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  CheckCheck,
  LucideIcon
} from 'lucide-react';
import { RequestStatus } from '@/types';

interface StatusBadgeProps {
  status: RequestStatus | string; // Allow string for flexibility during migration, but prefer enum
}

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
  animate?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig: Record<string, StatusConfig> = {
    [RequestStatus.PENDING]: {
      label: 'Pending',
      icon: Clock,
      className: 'status-badge status-pending',
    },
    [RequestStatus.APPROVED]: {
      label: 'Approved',
      icon: CheckCircle2,
      className: 'status-badge status-approved',
    },
    [RequestStatus.EXECUTING]: {
      label: 'Processing',
      icon: Loader2,
      className: 'status-badge status-executing',
      animate: true,
    },
    [RequestStatus.COMPLETED]: {
      label: 'Completed',
      icon: CheckCheck,
      className: 'status-badge status-completed',
    },
    [RequestStatus.FAILED]: {
      label: 'Failed',
      icon: AlertCircle,
      className: 'status-badge status-failed',
    },
    [RequestStatus.REJECTED]: {
      label: 'Rejected',
      icon: XCircle,
      className: 'status-badge status-rejected',
    },
  };

  // Fallback for unknown status
  const config = statusConfig[status] || statusConfig[RequestStatus.PENDING];
  const Icon = config.icon;

  return (
    <span className={config.className}>
      <Icon className={`w-3.5 h-3.5 mr-1 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
