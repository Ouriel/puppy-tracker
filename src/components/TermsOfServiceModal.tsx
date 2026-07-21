import React from 'react';
import { FileText, X, Shield, CheckCircle } from 'lucide-react';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">PupPace Terms of Service</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="bg-indigo-950/40 border border-indigo-700/40 p-3 rounded-xl flex items-center gap-2 text-indigo-300">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Effective Date: July 21, 2026. Terms governing the use of PupPace SaaS Platform.</span>
          </div>

          <h3 className="text-sm font-bold text-slate-100">1. Acceptance of Terms</h3>
          <p>
            By accessing or using PupPace ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the application.
          </p>

          <h3 className="text-sm font-bold text-slate-100">2. User Account & Activation</h3>
          <p>
            PupPace is a private SaaS platform. User accounts created require administrative activation by Super Admin Matthieu before full platform access is enabled. You are responsible for maintaining the confidentiality of your login credentials.
          </p>

          <h3 className="text-sm font-bold text-slate-100">3. Predictive Algorithms Disclaimer</h3>
          <p>
            PupPace provides adaptive statistical predictions for potty and feeding intervals. These predictions are informational guidelines based on historical logs and do not constitute formal veterinary medical advice. Always consult a certified veterinarian for pet medical concerns.
          </p>

          <h3 className="text-sm font-bold text-slate-100">4. Intellectual Property</h3>
          <p>
            All custom assets, Cocker Spaniel branding, algorithms, and interface designs are the property of PupPace.
          </p>

          <h3 className="text-sm font-bold text-slate-100">5. Termination</h3>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms or compromise system security.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>PupPace SaaS Platform Terms</span>
          </div>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
