import React from 'react';
import { Shield, X, Lock, CheckCircle } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">PupPace Privacy Policy</h2>
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
            <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Last Updated: July 21, 2026. Your family privacy is strictly protected.</span>
          </div>

          <h3 className="text-sm font-bold text-slate-100">1. Information We Collect</h3>
          <p>
            PupPace collects information to provide puppy activity tracking and predictions. This includes account details (name, email address), puppy profile data (breed, age, weight), and activity logs (pee, poop, food, naps, weights).
          </p>

          <h3 className="text-sm font-bold text-slate-100">2. How Information is Used</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>To compute adaptive machine learning potty and meal countdown predictions for your puppy.</li>
            <li>To synchronize logs across invited family caretakers (spouses, children, dog walkers).</li>
            <li>To generate downloadable Vet Health Summary Reports for veterinary appointments.</li>
          </ul>

          <h3 className="text-sm font-bold text-slate-100">3. Data Security & Storage</h3>
          <p>
            We implement standard encryption, token authentication (JWT & Google SSO), and strict administrative controls. We do not sell, lease, or distribute your family or pet data to third parties.
          </p>

          <h3 className="text-sm font-bold text-slate-100">4. Third-Party Services (Google OAuth)</h3>
          <p>
            When authenticating via Google SSO, we only request your basic profile (email and name) to verify your account identity. No additional Google Account data is accessed or stored.
          </p>

          <h3 className="text-sm font-bold text-slate-100">5. Contact Us</h3>
          <p>
            For privacy inquiries or data removal requests, contact the platform administrator at: <span className="font-mono text-indigo-300 font-bold">matthieu.jacquet@gmail.com</span>.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>GDPR & Google API Disclosure Compliant</span>
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
