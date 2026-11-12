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
  onDone?: (record: HealthRecord) => void; // a line's "Done": its add form, with that vaccine or product and today's date
}

/** "À faire": every open next date, overdue first. The passport and the dashboard card both show it, so they never disagree. */
export const HealthDueList: React.FC<HealthDueListProps> = ({ records, dogName, state = 'loaded', onDone }) => {
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
              <li key={record.id} className="flex flex-wrap items-center gap-2 min-h-11 py-1.5">
                <Icon className={`w-4 h-4 shrink-0 ${record.type === 'vaccination' ? 'text-teal-400' : 'text-amber-400'}`} aria-hidden="true" />
                <div className="min-w-[4.5rem] flex-1">
                  <div className="text-xs font-bold text-slate-100 line-clamp-2 break-words">{getRecordShortName(record, lang)}</div>
                  <div className="text-xs text-slate-400">{formatShortDate(record.boosterDate!, lang)}</div>
                </div>
                {/* Too narrow for the name (a 320 px phone): the badge and buttons go under it, on the right */}
                <div className="flex items-center gap-2 ml-auto">
                  <StatusBadge status={urgency} />
                  <AddToCalendarButton record={record} status={urgency} dogName={dogName} />
                  {onDone && (
                    <button
                      type="button"
                      onClick={() => onDone(record)}
                      // Named after its row, like the calendar button: 'Fait : Credelio Plus du 10 sept.'
                      aria-label={`${t.health.markDone}${t.common.colon} ${t.health.recordOn.replace('{name}', getRecordShortName(record, lang)).replace('{date}', formatShortDate(record.date, lang))}`}
                      className="min-h-11 min-w-11 px-2.5 flex items-center justify-center text-xs font-bold text-teal-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors shrink-0"
                    >
                      {t.health.markDone}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
