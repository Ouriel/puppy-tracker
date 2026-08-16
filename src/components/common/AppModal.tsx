import React from 'react';
import { Modal } from '@heroui/react';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '5xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'lg',
  children,
  footer,
  className = '',
}) => {
  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  const dialogSizeClass = sizeMap[size] || 'max-w-2xl';

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className={`bg-slate-900 border border-slate-800 text-slate-100 ${dialogSizeClass} w-full shadow-2xl rounded-2xl ${className}`}>
            <Modal.CloseTrigger />
            {title && (
              <Modal.Header className="px-6 pt-6 pb-2">
                <Modal.Heading className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  {title}
                </Modal.Heading>
                {subtitle && <p className="text-xs text-slate-400 mt-1 font-normal">{subtitle}</p>}
              </Modal.Header>
            )}
            <Modal.Body className="p-6">{children}</Modal.Body>
            {footer && <Modal.Footer className="px-6 pb-6 pt-2 border-t border-slate-800/80">{footer}</Modal.Footer>}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
