import React from 'react';
import { Input } from '@heroui/react';
import { useI18n } from '../../i18n';
import { WeightHint } from '../../components/common/WeightHint';
import type { UnifiedWeightEntry } from '../../utils/weight';

interface WeightFieldProps {
  id: string;
  value: string;
  /** Shown under the box; set, the save is blocked. */
  error?: 'weightInvalid' | 'dateTimeInFuture';
  lastWeighIn?: UnifiedWeightEntry;
  onChange: (value: string) => void;
}

/** Optional weight box of the vaccine and deworming forms: empty by default; filled, it saves a weight event of its own. */
export const WeightField: React.FC<WeightFieldProps> = ({ id, value, error, lastWeighIn, onChange }) => {
  const { t } = useI18n();
  return (
    <div className="sm:col-span-2 min-w-0">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.weight} ({t.units.kg})</label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        className="bg-slate-900 border-slate-700/80 text-slate-100"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onFocus={(event) => event.target.select()}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-red-400">{t.potty[error]}</p>}
      <WeightHint lastWeighIn={lastWeighIn} typedText={value} />
    </div>
  );
};
