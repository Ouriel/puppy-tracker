import React from 'react';
import type { PuppyProfile } from '../types';
import { Button } from '@heroui/react';
import { CarnetDeSanteView } from '../views/CarnetDeSanteView';
import { AppModal } from './common/AppModal';

interface CarnetDeSanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePuppy: PuppyProfile | null;
}

export const CarnetDeSanteModal: React.FC<CarnetDeSanteModalProps> = ({
  isOpen,
  onClose,
  activePuppy,
}) => {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      title="Health Passport & Vaccination Records"
      footer={
        <Button onPress={onClose} size="sm" className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800">
          Close
        </Button>
      }
    >
      <CarnetDeSanteView activePuppy={activePuppy} />
    </AppModal>
  );
};
