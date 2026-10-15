import React from 'react';
import { useI18n } from '../../i18n';
import { parseDecimalInput } from '../../utils/activityPayloads';
import { isUnlikelyWeight, type UnifiedWeightEntry } from '../../utils/weight';

interface WeightHintProps {
  lastWeighIn?: UnifiedWeightEntry;
  typedText: string;
}

/** Under a weight box: the last weigh-in, whatever its date, and a soft check when the typed value is far from it. Nothing before a first weigh-in. */
export const WeightHint: React.FC<WeightHintProps> = ({ lastWeighIn, typedText }) => {
  const { t, lang } = useI18n();
  if (!lastWeighIn) return null;

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const typedKg = parseDecimalInput(typedText);
  const lastWeighInDate = new Date(lastWeighIn.timestamp).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });

  return (
    <>
      <p className="mt-1.5 text-xs text-slate-400">
        {t.potty.lastWeighIn.replace('{weight}', lastWeighIn.weightKg.toLocaleString(locale)).replace('{date}', lastWeighInDate)}
      </p>
      {isUnlikelyWeight(typedKg, lastWeighIn.weightKg) && (
        <p role="status" className="mt-1 text-xs font-semibold text-amber-400">
          {t.potty.weightCheckDecimal.replace('{weight}', typedKg.toLocaleString(locale))}
        </p>
      )}
    </>
  );
};
