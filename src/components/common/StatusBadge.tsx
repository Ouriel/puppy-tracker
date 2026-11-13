import React from 'react';
import { Chip } from '@heroui/react';
import { AlertTriangle, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n';

type StatusUrgency = 'safe' | 'upToDate' | 'fulfilled' | 'soon' | 'overdue';

export const StatusBadge: React.FC<{ status: StatusUrgency }> = ({ status }) => {
  const { t } = useI18n();

  if (status === 'overdue') {
    return (
      <Chip color="danger" variant="soft" size="sm" className="font-bold text-rose-300 inline-flex items-center gap-1.5 motion-safe:animate-pulse">
        <AlertTriangle className="w-3 h-3" />
        <span>{t.potty.overdue}</span>
      </Chip>
    );
  }

  if (status === 'soon') {
    return (
      <Chip color="warning" variant="soft" size="sm" className="font-bold text-amber-300 inline-flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        <span>{t.potty.dueSoon}</span>
      </Chip>
    );
  }

  if (status === 'upToDate') {
    return (
      <Chip color="success" variant="soft" size="sm" className="font-bold text-emerald-300 inline-flex items-center gap-1.5">
        <ShieldCheck className="w-3 h-3" />
        <span>{t.health.statusUpToDate}</span>
      </Chip>
    );
  }

  return (
    <Chip color="success" variant="soft" size="sm" className="font-semibold text-emerald-300 inline-flex items-center gap-1.5">
      <CheckCircle2 className="w-3 h-3" />
      <span>{status === 'fulfilled' ? t.health.statusFulfilled : t.potty.allGood}</span>
    </Chip>
  );
};

