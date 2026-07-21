import React, { useState } from 'react';
import { X, BookOpen, CheckCircle, Clock, Heart, Search, ExternalLink } from 'lucide-react';

interface CareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BreedInfo {
  name: string;
  category: string;
  pottyTip: string;
  feedingTip: string;
  akcUrl: string;
}

const ALL_BREED_GUIDES: BreedInfo[] = [
  {
    name: 'Cocker Spaniel',
    category: 'Sporting / Medium',
    pottyTip: 'Gentle and eager to please! Responds best to high-value treat praise immediately after outdoor potty.',
    feedingTip: 'Keep floppy ears tucked or cleaned post-meal. Prone to ear infections if food/water remains on ears.',
    akcUrl: 'https://www.akc.org/dog-breeds/cocker-spaniel/',
  },
  {
    name: 'Golden Retriever',
    category: 'Sporting / Large',
    pottyTip: 'Fast learners with high energy. Needs outdoor potty break right after intense play sessions.',
    feedingTip: 'Rapid growth phase! Divide daily food into 3-4 structured meals to prevent bloat.',
    akcUrl: 'https://www.akc.org/dog-breeds/golden-retriever/',
  },
  {
    name: 'French Bulldog',
    category: 'Non-Sporting / Small',
    pottyTip: 'Smaller bladders require frequent potty breaks every 45-60 mins during waking hours.',
    feedingTip: 'Sensitive digestion. Slow-feeder bowls help prevent swallowing air.',
    akcUrl: 'https://www.akc.org/dog-breeds/french-bulldog/',
  },
  {
    name: 'German Shepherd',
    category: 'Herding / Large',
    pottyTip: 'Highly intelligent working breed. Thrives with routine schedules and verbal potty commands.',
    feedingTip: 'High metabolic energy requirement. High-protein puppy kibble recommended.',
    akcUrl: 'https://www.akc.org/dog-breeds/german-shepherd-dog/',
  },
  {
    name: 'Labrador Retriever',
    category: 'Sporting / Large',
    pottyTip: 'Very food motivated! Use kibble pieces as instant potty rewards outside.',
    feedingTip: 'Enthusiastic eaters! Watch weight gain carefully.',
    akcUrl: 'https://www.akc.org/dog-breeds/labrador-retriever/',
  },
  {
    name: 'Dachshund',
    category: 'Hound / Small',
    pottyTip: 'Can be stubborn with rain/cold weather. Crate training & indoor pee pads help during storms.',
    feedingTip: 'Maintain optimal weight to protect spine health.',
    akcUrl: 'https://www.akc.org/dog-breeds/dachshund/',
  },
  {
    name: 'Poodle (Toy / Miniature / Standard)',
    category: 'Non-Sporting / Variable',
    pottyTip: 'Exceptionally smart! Understands bell training by the door within 1-2 weeks.',
    feedingTip: 'Consistent meal timings prevent hypoglycemia in toy varieties.',
    akcUrl: 'https://www.akc.org/dog-breeds/poodle-standard/',
  },
  {
    name: 'Chihuahua',
    category: 'Toy / Small',
    pottyTip: 'Tiny bladder capacity (~45-60 mins). Keep indoor puppy pads in accessible spots.',
    feedingTip: 'Small kibble size formulated for toy breeds.',
    akcUrl: 'https://www.akc.org/dog-breeds/chihuahua/',
  },
];

export const CareGuideModal: React.FC<CareGuideModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedBreed, setSelectedBreed] = useState<BreedInfo>(ALL_BREED_GUIDES[0]);

  if (!isOpen) return null;

  const filteredBreeds = ALL_BREED_GUIDES.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>All-Breed Puppy Care & Potty Guidelines</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Search & Select Breed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400">
                Select or Search Breed Guide
              </label>
              <a
                href="https://www.akc.org/dog-breeds/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Browse Full AKC Directory</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search breed (e.g. Cocker Spaniel, Golden Retriever, French Bulldog...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {filteredBreeds.map((b) => (
                <button
                  key={b.name}
                  onClick={() => setSelectedBreed(b)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${
                    selectedBreed.name === b.name
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Breed Detail Card */}
          <div className="bg-gradient-to-br from-indigo-950/50 via-slate-900 to-purple-950/50 border border-indigo-700/40 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
                <span>{selectedBreed.name} Guide</span>
              </h3>
              <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2.5 py-0.5 rounded-full font-medium">
                {selectedBreed.category}
              </span>
            </div>
            <div className="text-xs space-y-1.5 pt-1">
              <p><strong>Potty Advice:</strong> {selectedBreed.pottyTip}</p>
              <p><strong>Feeding Advice:</strong> {selectedBreed.feedingTip}</p>
            </div>
            <div className="pt-2">
              <a
                href={selectedBreed.akcUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white font-semibold underline"
              >
                <span>Read Official AKC Breed Standard Guide</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Universal Age Bladder Rule */}
          <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl space-y-2">
            <h3 className="font-bold text-indigo-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Universal Age Bladder Capacity Rule</span>
            </h3>
            <ul className="text-xs list-disc list-inside space-y-1 text-slate-300 font-mono">
              <li><strong>8–10 Weeks:</strong> ~1 hour max hold time (or ~20m after meals/naps)</li>
              <li><strong>12 Weeks:</strong> ~2 hours max hold time</li>
              <li><strong>16 Weeks (4 Months):</strong> ~3–4 hours max hold time</li>
            </ul>
          </div>

          {/* Critical Potty Triggers */}
          <div>
            <h3 className="font-bold text-slate-100 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Critical Potty Triggers</span>
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

          {/* External Recommended Reading */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-slate-200">Recommended Professional Guides</h4>
            <div className="flex flex-col gap-1.5 text-indigo-400">
              <a href="https://pupford.com/potty-training/" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                <span>• Pupford Step-by-Step Potty & Crate Training Guide</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a href="https://www.avma.org/" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                <span>• AVMA American Veterinary Medical Association Pet Care Guidelines</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
