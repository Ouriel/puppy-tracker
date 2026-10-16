import React from 'react';
import { useI18n } from '../../i18n';
import { parseDecimalInput } from '../../utils/activityPayloads';
import { formatKg, isUnlikelyWeight, type GrowthProfile, type UnifiedWeightEntry } from '../../utils/weight';

interface WeightHintProps {
  /** A new weigh-in: the last one, shown as a hint and checked against. */
  lastWeighIn?: UnifiedWeightEntry;
  /** An edited weigh-in: the ones either side of it, checked against. */
  neighbours?: UnifiedWeightEntry[];
  typedText: string;
  /** When the typed weight was taken: the check moves the weigh-ins it compares with along the growth curve to it. */
  typedAt: string;
  profile?: GrowthProfile;
}

/** Under a weight box: the last weigh-in, whatever its date, and a soft check when the typed value is far from its curve. Nothing before a first weigh-in. */
export const WeightHint: React.FC<WeightHintProps> = ({ lastWeighIn, neighbours, typedText, typedAt, profile }) => {
  const { t, lang } = useI18n();
  const references = neighbours ?? (lastWeighIn ? [lastWeighIn] : []);
  if (references.length === 0) return null;

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const typedKg = parseDecimalInput(typedText);
  const isUnlikely = profile !== undefined && references.every((reference) => isUnlikelyWeight(typedKg, typedAt, reference, profile));

  return (
    <>
      {lastWeighIn && (
        <p className="mt-1.5 text-xs text-slate-400">
          {t.potty.lastWeighIn
            .replace('{weight}', formatKg(lastWeighIn.weightKg, lang))
            .replace('{date}', new Date(lastWeighIn.timestamp).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }))}
        </p>
      )}
      {isUnlikely && (
        <p role="status" className="mt-1 text-xs font-semibold text-amber-400">
          {t.potty.weightCheckDecimal.replace('{weight}', typedKg.toLocaleString(locale))}
        </p>
      )}
    </>
  );
};
