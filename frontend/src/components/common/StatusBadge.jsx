import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  CheckCheck 
} from 'lucide-react';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'status-badge status-pending',
    },
    approved: {
      label: 'Approved',
      icon: CheckCircle2,
      className: 'status-badge status-approved',
    },
    executing: {
      label: 'Processing',
      icon: Loader2,
      className: 'status-badge status-executing',
      animate: true,
    },
    completed: {
      label: 'Completed',
      icon: CheckCheck,
      className: 'status-badge status-completed',
    },
    failed: {
      label: 'Failed',
      icon: AlertCircle,
      className: 'status-badge status-failed',
    },
    rejected: {
      label: 'Rejected',
      icon: XCircle,
      className: 'status-badge status-rejected',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={config.className}>
      <Icon className={`w-3.5 h-3.5 mr-1 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
