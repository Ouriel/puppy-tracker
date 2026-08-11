import React from 'react';
import { Shield, Lock, CheckCircle } from 'lucide-react';
import { Modal, Button } from '@heroui/react';
import { useI18n } from '../i18n';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-indigo-400">
                <Shield className="w-5 h-5" />
                <span>{t.privacy.title}</span>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-indigo-950/40 border border-indigo-800/50 p-3 rounded-xl flex items-center gap-2 text-indigo-300">
                <Lock className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>{t.privacy.summary}</span>
              </div>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. {t.privacy.section1Title}</span>
                </h4>
                <p>{t.privacy.section1Desc}</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. {t.privacy.section2Title}</span>
                </h4>
                <p>{t.privacy.section2Desc}</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. {t.privacy.section3Title}</span>
                </h4>
                <p>{t.privacy.section3Desc}</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. {t.privacy.section4Title}</span>
                </h4>
                <p>{t.privacy.section4Desc}</p>
              </section>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="primary"
                onPress={onClose}
                size="sm"
              >
                {t.privacy.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
