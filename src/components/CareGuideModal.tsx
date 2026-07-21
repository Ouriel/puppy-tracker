import React from 'react';
import { X, BookOpen, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface CareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CareGuideModal: React.FC<CareGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Puppy Care & Potty Training Guidelines</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          <div className="bg-indigo-950/40 border border-indigo-700/50 p-4 rounded-xl space-y-2">
            <h3 className="font-bold text-indigo-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>The "Age in Months" Bladder Rule</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              A general rule of thumb for puppy bladder control while awake:
            </p>
            <ul className="text-xs list-disc list-inside space-y-1 text-slate-300 font-mono">
              <li><strong>8–10 Weeks:</strong> 1 hour max hold time (or ~20m after meals/naps)</li>
              <li><strong>12 Weeks:</strong> ~2 hours max hold time</li>
              <li><strong>16 Weeks (4 Months):</strong> ~3–4 hours max hold time</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-slate-100 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Critical Potty Triggers (When to take puppy out!)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="font-bold text-emerald-400 block mb-1">1. Immediately After Waking</span>
                <span>Take puppy out within 60 seconds of waking up from any nap.</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="font-bold text-emerald-400 block mb-1">2. 15–30 Mins After Feeding</span>
                <span>The gastrocolic reflex triggers digestion and potty urge shortly after eating.</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="font-bold text-emerald-400 block mb-1">3. After Play Sessions</span>
                <span>Excitement stimulates the bladder. Pause play every 15 mins for a potty break.</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <span className="font-bold text-emerald-400 block mb-1">4. Sniffing & Circling</span>
                <span>Abruptly stopping play, sniffing ground, or walking toward doors = URGENT!</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-100 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Puppy Stool Health Reference</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span className="font-bold text-emerald-400">Normal / Ideal:</span>
                <span>Firm, holds shape, easy to pick up without leaving residue.</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span className="font-bold text-amber-400">Soft:</span>
                <span>Slightly loose, holds form but leaves residue. Monitor diet.</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span className="font-bold text-red-400">Runny / Diarrhea:</span>
                <span>Liquid or unformed. Ensure hydration. Consult vet if persistent &gt;24h.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
