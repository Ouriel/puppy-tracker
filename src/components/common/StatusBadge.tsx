import React from 'react';
import { Chip } from '@heroui/react';
import { AlertTriangle, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n';

type StatusUrgency = 'safe' | 'upToDate' | 'soon' | 'overdue' | 'expired';

interface StatusBadgeProps {
  status: StatusUrgency | string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
  size = 'sm',
}) => {
  const { t } = useI18n();
  const norm = status.toLowerCase();

  if (norm === 'overdue' || norm === 'expired') {
    return (
      <Chip color="danger" variant="soft" size={size} className={`font-bold inline-flex items-center gap-1.5 animate-pulse ${className}`}>
        <AlertTriangle className="w-3 h-3" />
        <span>{label || t.potty.overdue}</span>
      </Chip>
    );
  }

  if (norm === 'soon' || norm === 'due soon') {
    return (
      <Chip color="warning" variant="soft" size={size} className={`font-bold inline-flex items-center gap-1.5 ${className}`}>
        <Clock className="w-3 h-3" />
        <span>{label || t.potty.dueSoon}</span>
      </Chip>
    );
  }

  if (norm === 'uptodate' || norm === 'up-to-date' || norm === 'up to date') {
    return (
      <Chip color="success" variant="soft" size={size} className={`font-bold inline-flex items-center gap-1.5 ${className}`}>
        <ShieldCheck className="w-3 h-3" />
        <span>{label || t.health.statusUpToDate}</span>
      </Chip>
    );
  }

  return (
    <Chip color="success" variant="soft" size={size} className={`font-semibold inline-flex items-center gap-1.5 ${className}`}>
      <CheckCircle2 className="w-3 h-3" />
      <span>{label || t.potty.allGood}</span>
    </Chip>
  );
};

