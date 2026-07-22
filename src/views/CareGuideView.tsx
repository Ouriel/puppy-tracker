import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck, Heart, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n';

interface CareGuideViewProps {
  onBackToDashboard?: () => void;
}

export const CareGuideView: React.FC<CareGuideViewProps> = ({ onBackToDashboard }) => {
  const { lang, t } = useI18n();

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
            <h4 className="font-bold text-amber-300">
              {lang === 'fr' ? '1. Horaires Réguliers & Timing' : '1. Regular Schedule & Timing'}
            </h4>
            <p>
              {lang === 'fr'
                ? 'Sortez votre chiot toutes les 1 à 2 heures, immédiatement après le réveil, 15 à 30 minutes après les repas, et après les séances de jeu.'
                : 'Take your puppy outside every 1-2 hours, immediately after waking up, 15-30 minutes after eating, and after energetic play sessions.'}
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-red-300">
              {lang === 'fr' ? '2. Éviter les Tapis de Propreté (Déconseillé)' : '2. Avoid Indoor Pads (Not Recommended)'}
            </h4>
            <p>
              {lang === 'fr'
                ? 'Les tapis d’apprentissage créent de la confusion en encourageant le chiot à uriner sur des surfaces molles à l’intérieur. Sortez-le directement dehors.'
                : 'Puppy pads create confusion by encouraging urination on soft indoor surfaces. Take puppies directly outdoors to establish clear housebreaking habits.'}
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-emerald-300">
              {lang === 'fr' ? '3. Récompense Immédiate & Félicitations' : '3. Immediate Reward & Praise'}
            </h4>
            <p>
              {lang === 'fr'
                ? 'Félicitez et donnez une friandise dans les 3 secondes suivant la réalisation du besoin dehors. Le renforcement positif immédiat crée l’habitude.'
                : 'Praise and treat your puppy within 3 seconds of completing their potty outdoors. Immediate positive reinforcement builds lifelong habits.'}
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-indigo-300">
              {lang === 'fr' ? '4. Nettoyage Enzymatique' : '4. Enzymatic Cleaning'}
            </h4>
            <p>
              {lang === 'fr'
                ? 'Nettoyez les accidents intérieurs avec un nettoyant enzymatique pour éliminer les phéromones qui attirent le chiot au même endroit.'
                : 'Clean indoor accidents with enzymatic cleaners to eliminate pheromone traces that attract puppies back to the same spot.'}
            </p>
          </div>
        </div>
      </div>

      {/* Breed Directory & Official French/International Resources */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
          <Heart className="w-4 h-4" />
          <span>{t.careGuide.breedGuides} & {lang === 'fr' ? 'Ressources Vétérinaires Officielles' : 'Official References'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* French Resources */}
          <a
            href="https://www.centrale-canine.fr/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
          >
            <span>🇫🇷 Société Centrale Canine (SCC) — Fiches Races & Conseils</span>
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
        </div>
      </div>
    </div>
  );
};
