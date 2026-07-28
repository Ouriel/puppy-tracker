import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck, Heart, ArrowLeft, GraduationCap } from 'lucide-react';
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

      {/* Esprit Dog Recommended Method Card */}
      <div className="bg-gradient-to-r from-amber-950/40 via-indigo-950/40 to-slate-900 border border-amber-500/30 p-6 rounded-2xl space-y-3 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-300">
              {t.careGuide.espritDogTitle}
            </h3>
            <p className="text-xs text-slate-400">
              {t.careGuide.espritDogSubtitle}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {t.careGuide.espritDogDesc}
        </p>
        <a
          href="https://www.espritdog.com/esprit-dog-chiot/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
        >
          <span>{t.careGuide.espritDogLink}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Potty Housebreaking Best Practices */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>{t.careGuide.generalTips}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-amber-300">
              {t.careGuide.tip1Title}
            </h4>
            <p>
              {t.careGuide.tip1Desc}
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-red-300">
              {t.careGuide.tip2Title}
            </h4>
            <p>
              {t.careGuide.tip2Desc}
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-emerald-300">
              {t.careGuide.tip3Title}
            </h4>
            <p>
              {t.careGuide.tip3Desc}
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-indigo-300">
              {t.careGuide.tip4Title}
            </h4>
            <p>
              {t.careGuide.tip4Desc}
            </p>
          </div>
        </div>
      </div>

      {/* Breed Directory & Official French/International Resources */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
          <Heart className="w-4 h-4" />
          <span>{t.careGuide.breedGuides} & {t.careGuide.officialReferences}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Esprit Dog & French Resources */}
          <a
            href="https://www.espritdog.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-amber-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇫🇷 Esprit Dog — Fiches Races & Méthodes d’Éducation</span>
            <ExternalLink className="w-4 h-4 text-amber-400" />
          </a>

          <a
            href="https://www.centrale-canine.fr/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇫🇷 Société Centrale Canine (SCC) — Encyclopédie des Races</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          <a
            href="https://www.santevet.com/articles/apprendre-la-proprete-a-son-chiot"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇫🇷 SantéVet — Guide Vétérinaire Propreté du Chiot</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          {/* International Resources */}
          <a
            href="https://www.akc.org/dog-breeds/english-cocker-spaniel/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇬🇧 AKC — English Cocker Spaniel Care Guide</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          <a
            href="https://www.akc.org/dog-breeds/french-bulldog/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇬🇧 AKC — French Bulldog Care & Health Guide</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>

          <a
            href="https://www.akc.org/dog-breeds/golden-retriever/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇬🇧 AKC — Golden Retriever Growth & Training</span>
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>
        </div>
      </div>
    </div>
  );
};
