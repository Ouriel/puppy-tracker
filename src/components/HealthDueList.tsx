import React from 'react';
import { Pill, Syringe } from 'lucide-react';
import type { HealthRecord, HealthRecordsLoadState } from '../types';
import { useI18n } from '../i18n';
import { getNextDue, getRecordShortName } from '../utils/health';
import { formatShortDate } from '../utils/date';
import { StatusBadge } from './common/StatusBadge';
import { AddToCalendarButton } from './common/AddToCalendarButton';

interface HealthDueListProps {
  records: HealthRecord[]; // one dog's vaccinations and dewormings
  dogName: string;
  state?: HealthRecordsLoadState; // skeleton rows while loading, one line once no load worked: never "nothing due" for unknown records
}

/** "À faire": every open next date, overdue first. The passport and the dashboard card both show it, so they never disagree. */
export const HealthDueList: React.FC<HealthDueListProps> = ({ records, dogName, state = 'loaded' }) => {
  const { t, lang } = useI18n();
  const dueItems = getNextDue(records);

  return (
    <section className="space-y-2" aria-busy={state === 'loading' || undefined}>
      <h3 className="text-sm sm:text-base font-bold text-slate-100">{t.health.toDo}</h3>
      {state === 'loading' ? (
        <div className="space-y-2">
          <span className="sr-only">{t.common.loading}</span>
          {[1, 2].map((index) => <div key={index} className="h-11 rounded-lg bg-slate-800/60 motion-safe:animate-pulse" />)}
        </div>
      ) : state === 'failed' ? (
        <p className="text-xs font-semibold text-amber-300">{t.health.recordsUnavailable}</p>
      ) : dueItems.length === 0 ? (
        <p className="text-xs text-slate-400">{t.health.nothingDue}</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {dueItems.map(({ record, urgency }) => {
            const Icon = record.type === 'vaccination' ? Syringe : Pill;
            return (
              <li key={record.id} className="flex items-center gap-2 min-h-11 py-1.5">
                <Icon className={`w-4 h-4 shrink-0 ${record.type === 'vaccination' ? 'text-teal-400' : 'text-amber-400'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 line-clamp-2 break-words">{getRecordShortName(record, lang)}</div>
                  <div className="text-xs text-slate-400">{formatShortDate(record.boosterDate!, lang)}</div>
                </div>
                <StatusBadge status={urgency} />
                <AddToCalendarButton record={record} status={urgency} dogName={dogName} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
