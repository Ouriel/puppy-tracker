import React from 'react';
import type { PuppyProfile } from '../types';
import { Modal, Button } from '@heroui/react';
import { CarnetDeSanteView } from '../views/CarnetDeSanteView';

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
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-base font-extrabold text-white">
                Health Passport & Vaccination Records
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-4">
              <CarnetDeSanteView activePuppy={activePuppy} />
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={onClose} size="sm" className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800">
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
