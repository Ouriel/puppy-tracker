import { Toast } from '@heroui/react';
import type { StoolConsistency } from '../../types';
import { useI18n } from '../../i18n';

// A one-tap poop is logged "normal": its toast offers the other usual stools
const CHOICES: StoolConsistency[] = ['soft', 'diarrhea'];

/** "Selles : [Mou] [Diarrhée]", in the description of a one-tap poop's toast, next to its Undo. */
export const StoolToastChoice = ({ onPick }: { onPick: (stoolConsistency: StoolConsistency) => void }) => {
  const { t } = useI18n();
  // mt-0: HeroUI's phone layout spaces an action from the text above it; these sit in one row with their label
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <span>{t.potty.stoolConsistencyPrefix}{t.common.colon}</span>
      {CHOICES.map((stoolConsistency) => (
        <Toast.ActionButton key={stoolConsistency} className="min-h-11 mt-0" onPress={() => onPick(stoolConsistency)}>
          {t.dashboard.stoolChip[stoolConsistency]}
        </Toast.ActionButton>
      ))}
    </span>
  );
};
