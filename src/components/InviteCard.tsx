import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { Button, Card } from '@heroui/react';
import type { HouseholdInvite } from '../types';
import { useI18n } from '../i18n';

interface InviteCardProps {
  invite: HouseholdInvite;
  /** Each resolves once the answer is handled: until then both buttons are disabled, so a second tap sends nothing */
  onJoin: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}

/** An invite into another household, at the top of the dashboard: nobody joins a household without saying yes here. */
export const InviteCard: React.FC<InviteCardProps> = ({ invite, onJoin, onDecline }) => {
  const { t } = useI18n();
  const [isAnswering, setIsAnswering] = useState(false);

  const name = invite.invitedBy || t.dashboard.someone;
  const message = invite.householdName
    ? t.dashboard.invitedYouNamed.replace('{name}', name).replace('{household}', invite.householdName)
    : t.dashboard.invitedYou.replace('{name}', name);

  const answer = async (reply: (id: string) => Promise<void>) => {
    setIsAnswering(true);
    await reply(invite.id);
    setIsAnswering(false);
  };

  return (
    <Card className="bg-slate-900 border border-indigo-800/60 text-slate-100">
      <Card.Content className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1 min-w-0 flex items-start gap-2 text-sm font-semibold break-words">
          <Users className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
          <span>{message}</span>
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="primary" size="sm" isDisabled={isAnswering} onPress={() => void answer(onJoin)} className="min-h-11 flex-1 sm:flex-none font-bold">
            {t.dashboard.joinInvite}
          </Button>
          <Button variant="outline" size="sm" isDisabled={isAnswering} onPress={() => void answer(onDecline)} className="min-h-11 flex-1 sm:flex-none border-slate-800">
            {t.dashboard.declineInvite}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};
