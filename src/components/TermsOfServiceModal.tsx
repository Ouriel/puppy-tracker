import React from 'react';
import { FileText, CheckCircle } from 'lucide-react';
import { Modal, Button } from '@heroui/react';
import { useI18n } from '../i18n';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-indigo-400">
                <FileText className="w-5 h-5" />
                <span>{t.terms.title}</span>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. {t.terms.section1Title}</span>
                </h4>
                <p>{t.terms.section1Desc}</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>2. {t.terms.section2Title}</span>
                </h4>
                <p>{t.terms.section2Desc}</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>3. {t.terms.section3Title}</span>
                </h4>
                <p>{t.terms.section3Desc}</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>4. {t.terms.section4Title}</span>
                </h4>
                <p>{t.terms.section4Desc}</p>
              </section>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="primary"
                onPress={onClose}
                size="sm"
              >
                {t.terms.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
