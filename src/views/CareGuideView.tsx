import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck, Heart, ArrowLeft, GraduationCap } from 'lucide-react';
import { useI18n } from '../i18n';
import { Card, Button, Link } from '@heroui/react';

interface CareGuideViewProps {
  onBackToDashboard?: () => void;
}

export const CareGuideView: React.FC<CareGuideViewProps> = ({ onBackToDashboard }) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with Back to Dashboard exit button */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
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
            <Button
              size="sm"
              onPress={onBackToDashboard}
              className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.careGuide.backToDashboard}</span>
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Esprit Dog Recommended Method Card */}
      <Card className="bg-gradient-to-r from-amber-950/40 via-indigo-950/40 to-slate-900 border-amber-500/30">
        <Card.Content className="p-6 space-y-3">
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
          <Link
            href="https://www.espritdog.com/esprit-dog-chiot/"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
          >
            <span>{t.careGuide.espritDogLink}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </Card.Content>
      </Card>

      {/* Potty Housebreaking Best Practices */}
      <Card>
        <Card.Content className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>{t.careGuide.generalTips}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
            <Card variant="default" className="bg-slate-950/60">
              <Card.Content className="p-4 space-y-2">
                <h4 className="font-bold text-amber-300">
                  {t.careGuide.tip1Title}
                </h4>
                <p>
                  {t.careGuide.tip1Desc}
                </p>
              </Card.Content>
            </Card>

            <Card variant="default" className="bg-slate-950/60">
              <Card.Content className="p-4 space-y-2">
                <h4 className="font-bold text-red-300">
                  {t.careGuide.tip2Title}
                </h4>
                <p>
                  {t.careGuide.tip2Desc}
                </p>
              </Card.Content>
            </Card>

            <Card variant="default" className="bg-slate-950/60">
              <Card.Content className="p-4 space-y-2">
                <h4 className="font-bold text-emerald-300">
                  {t.careGuide.tip3Title}
                </h4>
                <p>
                  {t.careGuide.tip3Desc}
                </p>
              </Card.Content>
            </Card>

            <Card variant="default" className="bg-slate-950/60">
              <Card.Content className="p-4 space-y-2">
                <h4 className="font-bold text-indigo-300">
                  {t.careGuide.tip4Title}
                </h4>
                <p>
                  {t.careGuide.tip4Desc}
                </p>
              </Card.Content>
            </Card>
          </div>
        </Card.Content>
      </Card>

      {/* Breed Directory & Official French/International Resources */}
      <Card>
        <Card.Content className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Heart className="w-4 h-4" />
            <span>{t.careGuide.breedGuides} & {t.careGuide.officialReferences}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Esprit Dog & French Resources */}
            <Link
              href="https://www.espritdog.com/"
              target="_blank"
              className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-amber-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
            >
              <span>🇫🇷 Esprit Dog — Fiches Races & Méthodes d'Éducation</span>
              <ExternalLink className="w-4 h-4 text-amber-400" />
            </Link>

            <Link
              href="https://www.centrale-canine.fr/"
              target="_blank"
              className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
            >
              <span>🇫🇷 Société Centrale Canine (SCC) — Encyclopédie des Races</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </Link>

            <Link
              href="https://www.santevet.com/articles/apprendre-la-proprete-a-son-chiot"
              target="_blank"
              className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
            >
              <span>🇫🇷 SantéVet — Guide Vétérinaire Propreté du Chiot</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </Link>

            {/* International Resources */}
            <Link
              href="https://www.akc.org/dog-breeds/english-cocker-spaniel/"
              target="_blank"
              className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
            >
              <span>🇬🇧 AKC — English Cocker Spaniel Care Guide</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </Link>

            <Link
              href="https://www.akc.org/dog-breeds/french-bulldog/"
              target="_blank"
              className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
            >
              <span>🇬🇧 AKC — French Bulldog Care & Health Guide</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </Link>

            <Link
              href="https://www.akc.org/dog-breeds/golden-retriever/"
              target="_blank"
              className="p-3.5 bg-slate-950/40 border border-slate-800 hover:border-indigo-500 rounded-xl transition flex items-center justify-between text-xs text-slate-200"
            >
              <span>🇬🇧 AKC — Golden Retriever Growth & Training</span>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </Link>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
