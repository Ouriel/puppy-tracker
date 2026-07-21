import React, { useState } from 'react';
import { BookOpen, Search, ExternalLink, Heart, ShieldAlert, Award } from 'lucide-react';

export const CareGuideView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const breeds = [
    {
      name: 'Cocker Spaniel',
      group: 'Sporting Group',
      pottyTip: 'High energy puppy requiring potty breaks every 1.5 - 2 hours daytime. Reward heavily with praise.',
      earCare: 'Long floppy ears require daily inspection and cleaning after walks to prevent moisture buildup.',
      exerciseMin: '45-60 mins/day',
      akcLink: 'https://www.akc.org/dog-breeds/cocker-spaniel/',
    },
    {
      name: 'French Bulldog',
      group: 'Non-Sporting Group',
      pottyTip: 'Sensitive to heat. Take out frequently for short potty trips; avoid strenuous outdoor activity in direct sun.',
      earCare: 'Clean facial wrinkles and ears regularly with gentle pet wipes.',
      exerciseMin: '20-30 mins/day',
      akcLink: 'https://www.akc.org/dog-breeds/french-bulldog/',
    },
    {
      name: 'Golden Retriever',
      group: 'Sporting Group',
      pottyTip: 'Fast learners. Establish a consistent potty spot in the yard immediately after naps and meals.',
      earCare: 'Inspect ears after swimming or rainy outdoor play.',
      exerciseMin: '60+ mins/day',
      akcLink: 'https://www.akc.org/dog-breeds/golden-retriever/',
    },
    {
      name: 'German Shepherd',
      group: 'Herding Group',
      pottyTip: 'Thrives on routine and clear commands. Highly intelligent and responds well to clicker training.',
      earCare: 'Ears stand erect naturally; check for dirt weekly.',
      exerciseMin: '60-90 mins/day',
      akcLink: 'https://www.akc.org/dog-breeds/german-shepherd-dog/',
    },
    {
      name: 'Labrador Retriever',
      group: 'Sporting Group',
      pottyTip: 'Food motivated. Use tiny kibble pieces as immediate reward when peeing outside.',
      earCare: 'Check ears for moisture after water activity.',
      exerciseMin: '60+ mins/day',
      akcLink: 'https://www.akc.org/dog-breeds/labrador-retriever/',
    },
  ];

  const filteredBreeds = breeds.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">All-Breed Care & Potty Guide</h2>
            <p className="text-xs text-slate-400">Breed-specific potty training tips, ear care, and official AKC resources</p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search breed..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* External Verified Resource Directory */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="https://www.akc.org/dog-owners/training/how-to-potty-train-a-puppy/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl space-y-1 group transition shadow cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-indigo-300">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>AKC Potty Guide</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="text-[11px] text-slate-400">Official American Kennel Club potty training steps.</p>
        </a>

        <a
          href="https://pupford.com/puppy-potty-training-guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl space-y-1 group transition shadow cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-indigo-300">
            <span className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-400" />
              <span>Pupford Schedule</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="text-[11px] text-slate-400">Hour-by-hour puppy schedule & positive reinforcement.</p>
        </a>

        <a
          href="https://www.avma.org/resources-tools/pet-owners/petcare/puppy-socialization"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl space-y-1 group transition shadow cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-indigo-300">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>AVMA Health Guidelines</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="text-[11px] text-slate-400">American Veterinary Medical Association guidelines.</p>
        </a>
      </div>

      {/* Breeds List */}
      <div className="space-y-3">
        {filteredBreeds.map((breed) => (
          <div key={breed.name} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{breed.name}</span>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded font-semibold">
                  {breed.group}
                </span>
              </h3>
              <a
                href={breed.akcLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <span>AKC Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-xs text-slate-300">
              <strong className="text-amber-400">Potty Tip:</strong> {breed.pottyTip}
            </p>
            <p className="text-xs text-slate-400">
              <strong className="text-indigo-300">Ear & Grooming Care:</strong> {breed.earCare}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
