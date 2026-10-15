import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useI18n } from '../i18n';

interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** A yes/no question before an action that moves someone between households. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, message, confirmLabel, onConfirm, onClose }) => {
  const { t } = useI18n();
  return (
    <Modal isOpen={isOpen} onOpenChange={(isModalOpen) => !isModalOpen && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>{message}</span>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Footer className="border-t border-slate-800 pt-3">
              <Button onPress={onClose} className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800">
                {t.potty.cancel}
              </Button>
              <Button
                onPress={() => {
                  onConfirm();
                  onClose();
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
