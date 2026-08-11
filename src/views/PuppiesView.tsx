import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Dog, Plus, Trash2, Edit3, Utensils, Calendar } from 'lucide-react';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
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

    const finalBreed = breed === 'Other' ? (customBreed.trim() || 'Mixed Breed') : breed;

    const newPup: PuppyProfile = {
      id: `pup-${Date.now()}`,
      name: name.trim(),
      breed: finalBreed,
      birthDate,
      dailyFoodGramGoal: Math.max(10, dailyFoodGramGoal),
      targetMealsPerDay: Math.max(1, Math.min(6, targetMealsPerDay)),
      avatarUrl: '/cocker_spaniel_mascot.jpg',
      notes,
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

    const finalBreed = editBreed === 'Other' ? (editCustomBreed.trim() || 'Mixed Breed') : editBreed;

    const updatedPup: PuppyProfile = {
      ...editingPuppy,
      name: editName.trim(),
      breed: finalBreed,
      birthDate: editBirthDate,
      dailyFoodGramGoal: Math.max(10, editFoodGramGoal),
      targetMealsPerDay: Math.max(1, Math.min(6, editMealsPerDay)),
      notes: editNotes,
    };

    onUpdatePuppy(updatedPup);
    setEditingPuppy(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <Card>
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
        <Card>
          <form onSubmit={handleCreateSubmit}>
            <Card.Header>
              <Card.Title>{t.puppies.registerNewDog}</Card.Title>
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
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                  <Select value={breed} onChange={(val) => setBreed(val as string)}>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {DOG_BREEDS.map((breedOption) => (
                          <ListBoxItem key={breedOption} id={breedOption} textValue={breedOption}>
                            {breedOption}
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
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.foodGramGoal}
                  </label>
                  <Input
                    type="number"
                    value={dailyFoodGramGoal}
                    onChange={(event) => setDailyFoodGramGoal(Number(event.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.mealsPerDay}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    value={targetMealsPerDay}
                    onChange={(event) => setTargetMealsPerDay(Number(event.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                  <Input
                    type="text"
                    placeholder={t.puppies.careInstructionsPlaceholder}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
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
      <Modal isOpen={!!editingPuppy} onOpenChange={(open) => !open && setEditingPuppy(null)}>
        <Modal.Backdrop>
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  <span>{t.puppies.editProfileTitle.replace('{name}', editingPuppy?.name || '')}</span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <form onSubmit={handleEditSubmit} id="edit-puppy-form" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        {t.puppies.dogName}
                      </label>
                      <Input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                      <Select value={editBreed} onChange={(val) => setEditBreed(val as string)}>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {DOG_BREEDS.map((breedOption) => (
                              <ListBoxItem key={breedOption} id={breedOption} textValue={breedOption}>
                                {breedOption}
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      {editBreed === 'Other' && (
                        <Input
                          type="text"
                          placeholder={t.puppies.specifyCustomBreed}
                          value={editCustomBreed}
                          onChange={(event) => setEditCustomBreed(event.target.value)}
                          className="mt-2"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        {t.puppies.foodGramGoal}
                      </label>
                      <Input
                        type="number"
                        value={editFoodGramGoal}
                        onChange={(event) => setEditFoodGramGoal(Number(event.target.value))}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        {t.puppies.mealsPerDay}
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="6"
                        value={editMealsPerDay}
                        onChange={(event) => setEditMealsPerDay(Number(event.target.value))}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                      <Input
                        type="date"
                        value={editBirthDate}
                        onChange={(event) => setEditBirthDate(event.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                      <Input
                        type="text"
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                      />
                    </div>
                  </div>
                </form>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="tertiary"
                  onPress={() => setEditingPuppy(null)}
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
        <Card className="border-dashed p-10 text-center">
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
                className={isActive ? 'border-indigo-500/80 ring-2 ring-indigo-500/20' : ''}
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
                        <p className="text-xs text-slate-400">{pup.breed}</p>
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
                      <Button
                        variant="tertiary"
                        size="sm"
                        isIconOnly
                        onPress={() => handleStartEdit(pup)}
                        aria-label="Edit Dog Profile"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger-soft"
                        size="sm"
                        isIconOnly
                        onPress={() => onDeletePuppy(pup.id)}
                        aria-label="Delete Puppy Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Utensils className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{pup.dailyFoodGramGoal}g / jour ({pup.targetMealsPerDay || 3} repas)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Né le {pup.birthDate}</span>
                    </div>
                  </div>

                  {pup.notes && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/20 p-2 rounded-lg border border-slate-800/50">
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
