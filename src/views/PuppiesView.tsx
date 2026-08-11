import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Dog, Plus, Trash2, Edit3, Utensils, Calendar } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatBreedName } from '../utils/breeds';
import { Card, Button, Input, Select, ListBox, ListBoxItem, Modal, Chip } from '@heroui/react';
import { DOG_BREEDS } from '../constants/breeds';

interface PuppiesViewProps {
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => void;
  onUpdatePuppy: (puppy: PuppyProfile) => void;
  onDeletePuppy: (id: string) => void;
}

export const PuppiesView: React.FC<PuppiesViewProps> = ({
  puppies,
  activePuppyId,
  onSelectPuppy,
  onAddPuppy,
  onUpdatePuppy,
  onDeletePuppy,
}) => {
  const { t, lang } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [editingPuppy, setEditingPuppy] = useState<PuppyProfile | null>(null);

  // New Puppy Form State
  const [name, setName] = useState('');
  const [breed, setBreed] = useState(DOG_BREEDS[0]);
  const [customBreed, setCustomBreed] = useState('');
  const [birthDate, setBirthDate] = useState('2026-05-01');
  const [dailyFoodGramGoal, setDailyFoodGramGoal] = useState<number>(200);
  const [targetMealsPerDay, setTargetMealsPerDay] = useState<number>(3);
  const [notes, setNotes] = useState('');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editBreed, setEditBreed] = useState(DOG_BREEDS[0]);
  const [editCustomBreed, setEditCustomBreed] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editFoodGramGoal, setEditFoodGramGoal] = useState<number>(200);
  const [editMealsPerDay, setEditMealsPerDay] = useState<number>(3);
  const [editNotes, setEditNotes] = useState('');

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const finalBreed = breed === 'Other' ? customBreed.trim() || 'Custom Breed' : breed;

    const newPup: PuppyProfile = {
      id: `pup-${Date.now()}`,
      name: name.trim(),
      breed: finalBreed,
      birthDate,
      dailyFoodGramGoal,
      targetMealsPerDay,
      notes: notes.trim() || undefined,
    };

    onAddPuppy(newPup);
    setIsAdding(false);
    setName('');
    setNotes('');
  };

  const handleStartEdit = (pup: PuppyProfile) => {
    setEditingPuppy(pup);
    setEditName(pup.name);
    if (DOG_BREEDS.includes(pup.breed)) {
      setEditBreed(pup.breed);
      setEditCustomBreed('');
    } else {
      setEditBreed('Other');
      setEditCustomBreed(pup.breed);
    }
    setEditBirthDate(pup.birthDate || '2026-05-01');
    setEditFoodGramGoal(pup.dailyFoodGramGoal || 200);
    setEditMealsPerDay(pup.targetMealsPerDay || 3);
    setEditNotes(pup.notes || '');
  };

  const handleEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPuppy || !editName.trim()) return;

    const finalBreed = editBreed === 'Other' ? editCustomBreed.trim() || 'Custom Breed' : editBreed;

    const updatedPup: PuppyProfile = {
      ...editingPuppy,
      name: editName.trim(),
      breed: finalBreed,
      birthDate: editBirthDate,
      dailyFoodGramGoal: editFoodGramGoal,
      targetMealsPerDay: editMealsPerDay,
      notes: editNotes.trim() || undefined,
    };

    onUpdatePuppy(updatedPup);
    setEditingPuppy(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
              <Dog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{t.puppies.title}</h2>
              <p className="text-xs text-slate-400">{t.puppies.subtitle}</p>
            </div>
          </div>

          <Button
            variant="primary"
            onPress={() => setIsAdding(!isAdding)}
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {isAdding ? t.potty.cancel : t.puppies.addDog}
          </Button>
        </Card.Content>
      </Card>

      {/* Add Dog Form */}
      {isAdding && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <form onSubmit={handleCreateSubmit}>
            <Card.Header>
              <Card.Title className="text-white font-bold">{t.puppies.registerNewDog}</Card.Title>
            </Card.Header>
            <Card.Content className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.dogName}
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Cookie"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                  <Select value={breed} onChange={(val) => setBreed(val as string)}>
                    <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                      <ListBox>
                        {DOG_BREEDS.map((breedOption) => (
                          <ListBoxItem key={breedOption} id={breedOption} textValue={formatBreedName(breedOption, lang)}>
                            {formatBreedName(breedOption, lang)}
                          </ListBoxItem>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  {breed === 'Other' && (
                    <Input
                      type="text"
                      placeholder={t.puppies.specifyCustomBreed}
                      value={customBreed}
                      onChange={(event) => setCustomBreed(event.target.value)}
                      className="mt-2 bg-slate-950 border-slate-800 text-slate-100"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                  <Input
                    type="date"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.foodGramGoal}</label>
                  <Input
                    type="number"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={String(dailyFoodGramGoal)}
                    onChange={(event) => setDailyFoodGramGoal(Number(event.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.dashboard.targetMealsPerDay}</label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={String(targetMealsPerDay)}
                    onChange={(event) => setTargetMealsPerDay(Number(event.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                  <Input
                    type="text"
                    placeholder="e.g. Microchip #9810981"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="tertiary"
                  onPress={() => setIsAdding(false)}
                >
                  {t.potty.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  {t.puppies.savePuppyProfile}
                </Button>
              </div>
            </Card.Content>
          </form>
        </Card>
      )}

      {/* Edit Dog Modal */}
      <Modal isOpen={!!editingPuppy} onOpenChange={(open) => { if (!open) setEditingPuppy(null); }}>
        <Modal.Backdrop>
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-white font-bold">{t.puppies.editProfileTitle}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-4">
                <form id="edit-puppy-form" onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        {t.puppies.dogName}
                      </label>
                      <Input
                        type="text"
                        className="bg-slate-950 border-slate-800 text-slate-100"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                      <Select value={editBreed} onChange={(val) => setEditBreed(val as string)}>
                        <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                          <ListBox>
                            {DOG_BREEDS.map((breedOption) => (
                              <ListBoxItem key={breedOption} id={breedOption} textValue={formatBreedName(breedOption, lang)}>
                                {formatBreedName(breedOption, lang)}
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      {editBreed === 'Other' && (
                        <Input
                          type="text"
                          placeholder={t.puppies.specifyCustomBreed}
                          className="bg-slate-950 border-slate-800 text-slate-100 mt-2"
                          value={editCustomBreed}
                          onChange={(event) => setEditCustomBreed(event.target.value)}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                      <Input
                        type="date"
                        className="bg-slate-950 border-slate-800 text-slate-100"
                        value={editBirthDate}
                        onChange={(event) => setEditBirthDate(event.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.foodGramGoal}</label>
                      <Input
                        type="number"
                        className="bg-slate-950 border-slate-800 text-slate-100"
                        value={String(editFoodGramGoal)}
                        onChange={(event) => setEditFoodGramGoal(Number(event.target.value))}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.dashboard.targetMealsPerDay}</label>
                      <Input
                        type="number"
                        min="1"
                        max="6"
                        className="bg-slate-950 border-slate-800 text-slate-100"
                        value={String(editMealsPerDay)}
                        onChange={(event) => setEditMealsPerDay(Number(event.target.value))}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                      <Input
                        type="text"
                        className="bg-slate-950 border-slate-800 text-slate-100"
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                      />
                    </div>
                  </div>
                </form>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  onPress={() => setEditingPuppy(null)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 font-bold"
                >
                  {t.potty.cancel}
                </Button>
                <Button
                  type="submit"
                  form="edit-puppy-form"
                  variant="primary"
                >
                  {t.puppies.updateProfile}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Puppies Grid */}
      {puppies.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 border-dashed p-10 text-center text-slate-100">
          <Card.Content className="space-y-3">
            <Dog className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">
              {t.puppies.noDogsInHousehold}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {t.puppies.clickAddDogAbove}
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {puppies.map((pup) => {
            const isActive = pup.id === activePuppyId;

            return (
              <Card
                key={pup.id}
                className={`bg-slate-900 border-slate-800 text-slate-100 ${
                  isActive ? 'border-indigo-500/80 ring-2 ring-indigo-500/20' : ''
                }`}
              >
                <Card.Content className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={pup.avatarUrl || '/cocker_spaniel_mascot.jpg'}
                        alt={pup.name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-500/50 shadow"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{pup.name}</h3>
                          {isActive && (
                            <Chip color="success" variant="soft" size="sm">
                              {t.puppies.active}
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{formatBreedName(pup.breed, lang)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => onSelectPuppy(pup.id)}
                        >
                          {t.puppies.select}
                        </Button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEdit(pup)}
                        aria-label="Edit Profile"
                        className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete profile for ${pup.name}?`)) {
                            onDeletePuppy(pup.id);
                          }
                        }}
                        aria-label="Delete Dog"
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-semibold">{t.puppies.foodGramGoal}</div>
                        <div className="font-bold text-slate-200">{pup.dailyFoodGramGoal || 200}{t.units.grams} ({pup.targetMealsPerDay || 3} meals)</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-semibold">{t.puppies.birthDate}</div>
                        <div className="font-bold text-slate-200">{pup.birthDate || 'Unknown'}</div>
                      </div>
                    </div>
                  </div>

                  {pup.notes && (
                    <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 italic font-mono">
                      "{pup.notes}"
                    </p>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
