import { Modal } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Default: "Delete" in the app language */
  confirmLabel?: string;
  /** Default: "Cancel" in the app language */
  cancelLabel?: string;
  /** 'danger' (default): a delete, red with a warning sign; 'primary': a harmless question (approve, add, move) */
  tone?: 'danger' | 'primary';
}

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmLabel, cancelLabel, tone = 'danger' }: ConfirmationModalProps) {
  const { t } = useI18n();
  const isDanger = tone === 'danger';
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop className="bg-slate-950/80 backdrop-blur-sm">
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden">
            <Modal.Header className="p-5 pb-0">
              <Modal.Heading className={`flex items-center gap-2 text-base font-extrabold ${isDanger ? 'text-red-400' : 'text-slate-100'}`}>
                {isDanger && <AlertTriangle className="w-5 h-5" aria-hidden="true" />}
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="px-5 py-4">
              <p className="text-sm text-slate-300">{message}</p>
            </Modal.Body>
            <Modal.Footer className="flex items-center justify-end gap-3 p-5 pt-0">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-4 rounded-xl border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 hover:text-white transition-colors"
              >
                {cancelLabel ?? t.potty.cancel}
              </button>
              <button
                type="button"
                onClick={() => { onConfirm(); onClose(); }}
                className={`min-h-11 px-4 rounded-xl font-bold text-xs transition-all ${
                  isDanger
                    ? 'bg-red-950 text-red-400 border border-red-900/50 hover:bg-red-900/50 hover:text-red-300'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {confirmLabel ?? t.common.delete}
              </button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
