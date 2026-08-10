import React from 'react';
import type { Activity } from '../types';
import { QuickLogModal } from './QuickLogModal';

interface EditActivityModalProps {
  activity: Activity;
  onSave: (updated: Partial<Activity> & { id: string }) => void;
  onClose: () => void;
}

export const EditActivityModal: React.FC<EditActivityModalProps> = ({
  activity,
  onSave,
  onClose,
}) => {
  return (
    <QuickLogModal
      isOpen={true}
      activityToEdit={activity}
      currentUser={activity.loggedBy}
      onClose={onClose}
      onSave={onSave}
    />
  );
};
