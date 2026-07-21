import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck, Heart, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n';

interface CareGuideViewProps {
  onBackToDashboard?: () => void;
}

export const CareGuideView: React.FC<CareGuideViewProps> = ({ onBackToDashboard }) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header with Back to Dashboard exit button */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-teal-600 rounded-xl shadow-md">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{t.careGuide.title}</h2>
            <p className="text-xs text-slate-400">{t.careGuide.subtitle}</p>
          </div>
        </div>

        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.careGuide.backToDashboard}</span>
          </button>
        )}
      </div>

      {/* Potty Housebreaking Best Practices */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>{t.careGuide.generalTips}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-amber-300">1. Regular Schedule & Timing</h4>
            <p>
              Take your puppy outside every 1-2 hours, immediately after waking up, 15-30 minutes after eating, and after energetic play sessions.
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-red-300">2. Avoid Indoor Pads (Déconseillé)</h4>
            <p>
              Puppy pads create confusion by encouraging urination on soft indoor surfaces. Take puppies directly outdoors to establish clear housebreaking habits.
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-emerald-300">3. Immediate Reward & Praise</h4>
            <p>
              Praise and treat your puppy within 3 seconds of completing their potty outdoors. Immediate positive reinforcement builds lifelong habits.
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-indigo-300">4. Enzymatic Cleaning</h4>
            <p>
              Clean indoor accidents with enzymatic cleaners to eliminate pheromone traces that attract puppies back to the same spot.
            </p>
          </div>
        </div>
      </div>

      {/* Breed Directory Card Links */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
          <Heart className="w-4 h-4" />
          <span>{t.careGuide.breedGuides} & Official References</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://www.akc.org/dog-breeds/english-cocker-spaniel/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>English Cocker Spaniel Care Guide</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          <a
            href="https://www.akc.org/dog-breeds/french-bulldog/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>French Bulldog Care & Health Guide</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          <a
            href="https://www.akc.org/dog-breeds/golden-retriever/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>Golden Retriever Puppy Growth Guide</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          <a
            href="https://www.akc.org/dog-breeds/australian-shepherd/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>Australian Shepherd Activity & Training</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>
        </div>
      </div>
    </div>
  );
};
