import React from 'react';
import { CalendarPlus } from 'lucide-react';
import type { HealthRecord } from '../../types';
import type { HealthUrgency } from '../../utils/health';
import { downloadDueDateIcs } from '../../utils/calendar';
import { useI18n } from '../../i18n';

interface AddToCalendarButtonProps {
  record: HealthRecord;
  status: HealthUrgency;
  dogName: string;
}

/** Downloads a one-event .ics on the record's next date. Nothing when it has none, a later dose renewed it, or it is overdue (no reminder could fire). */
export const AddToCalendarButton: React.FC<AddToCalendarButtonProps> = ({ record, status, dogName }) => {
  const { t, lang } = useI18n();
  const { boosterDate } = record;

  if (!boosterDate || status === 'fulfilled' || status === 'overdue') return null;

  return (
    <button
      type="button"
      onClick={() => downloadDueDateIcs({ ...record, boosterDate }, dogName, t, lang)}
      aria-label={t.health.addToCalendar}
      title={t.health.addToCalendar}
      className="p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-teal-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors shrink-0"
    >
      <CalendarPlus className="w-3.5 h-3.5" />
    </button>
  );
};
