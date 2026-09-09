import type { Activity, PuppyProfile, Caretaker, HealthRecord } from '../types';
import type { TranslationKeys } from '../i18n/types';
import { formatLocalDate, parseIsoDate, formatLogicalDate, getUserTimezone } from './date';
import { resolveCaretakerName } from './caretakers';
import { formatBreedName } from '../data/breedsCatalog';

function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value).trim().replace(/"/g, '""');
  return `"${stringValue}"`;
}

/**
 * Exports puppy activity logs to a formatted CSV file with UTF-8 BOM for Excel/Numbers compatibility.
 */
export function exportActivitiesToCSV(
  activities: Activity[],
  profile: PuppyProfile,
  lang: 'en' | 'fr' = 'fr',
  caretakers: Caretaker[] = []
): boolean {
  if (!activities || activities.length === 0) {
    return false;
  }

  const isFrench = lang === 'fr';
  const tz = getUserTimezone();

  const headers = isFrench
    ? [
        'Date',
        'Heure',
        'Type d\'Activité',
        'Lieu Besoins',
        'Consistance Selles',
        'Quantité (g)',
        'Quantité (cups)',
        'Durée (min)',
        'Poids (kg)',
        'Médicament',
        'Enregistré Par',
        'Notes',
      ]
    : [
        'Date',
        'Time',
        'Activity Type',
        'Potty Location',
        'Stool Consistency',
        'Quantity (g)',
        'Quantity (cups)',
        'Duration (min)',
        'Weight (kg)',
        'Medication',
        'Logged By',
        'Notes',
      ];

  const sortedActivities = [...activities].sort(
    (activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime()
  );

  const formatLocation = (location?: string) => {
    if (!location) return '';
    if (location === 'outside') return isFrench ? 'Dehors' : 'Outside';
    if (location === 'indoor_accident') return isFrench ? 'Accident Intérieur' : 'Indoor Accident';
    return location;
  };

  const formatConsistency = (consistency?: string) => {
    if (!consistency) return '';
    if (consistency === 'normal') return isFrench ? 'Normale' : 'Normal';
    if (consistency === 'soft') return isFrench ? 'Molle' : 'Soft';
    if (consistency === 'liquid') return isFrench ? 'Liquide' : 'Liquid';
    if (consistency === 'hard') return isFrench ? 'Dure' : 'Hard';
    return consistency;
  };

  const formatActivityType = (type: string) => {
    if (type === 'pee') return isFrench ? 'Pipi' : 'Pee';
    if (type === 'poop') return isFrench ? 'Caca' : 'Poop';
    if (type === 'food') return isFrench ? 'Repas' : 'Meal';
    if (type === 'weight') return isFrench ? 'Pesée' : 'Weight';
    if (type === 'medication') return isFrench ? 'Médicament' : 'Medication';
    return type.toUpperCase();
  };

  const rows = sortedActivities.map((activity) => {
    const activityDate = parseIsoDate(activity.timestamp);
    const dateStr = formatLogicalDate(activity.timestamp, tz);
    const timeStr = activityDate.toLocaleTimeString(isFrench ? 'fr-FR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const resolvedCaretaker = resolveCaretakerName(activity.loggedBy, caretakers);

    return [
      escapeCsvField(dateStr),
      escapeCsvField(timeStr),
      escapeCsvField(formatActivityType(activity.type)),
      escapeCsvField(formatLocation(activity.pottyLocation)),
      escapeCsvField(formatConsistency(activity.stoolConsistency)),
      escapeCsvField(activity.quantityGrams ?? ''),
      escapeCsvField(activity.quantityCups ?? ''),
      escapeCsvField(activity.durationMinutes ?? ''),
      escapeCsvField(activity.weightKg ?? ''),
      escapeCsvField(activity.medicationName || ''),
      escapeCsvField(resolvedCaretaker),
      escapeCsvField(activity.notes || ''),
    ].join(',');
  });

  // UTF-8 BOM prefix (\uFEFF) ensures Excel and Apple Numbers properly decode French accents (é, è, ê, etc.)
  const escapedHeaders = headers.map(escapeCsvField).join(',');
  const csvContent = '\uFEFF' + [escapedHeaders, ...rows].join('\r\n');
  const safeDogName = (profile?.name || 'puppy').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  downloadCsvFile(csvContent, `${safeDogName}_activities_${formatLocalDate()}.csv`);

  return true;
}

/**
 * Opens a print-optimized window for the Puppy Activity Timeline and triggers browser PDF/print dialog.
 */
export function printActivitiesReport(
  activities: Activity[],
  profile: PuppyProfile,
  lang: 'en' | 'fr' = 'fr',
  _t?: TranslationKeys,
  caretakers: Caretaker[] = []
): boolean {
  if (typeof window === 'undefined') return false;

  const windowPrint = window.open('', '', 'width=900,height=1000');
  if (!windowPrint) return false;

  const isFrench = lang === 'fr';
  const locale = isFrench ? 'fr-FR' : 'en-US';
  const generatedDate = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sortedActivities = [...activities].sort(
    (activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime()
  );

  const totalLogs = sortedActivities.length;
  const outsideCount = sortedActivities.filter((activity) => activity.pottyLocation === 'outside').length;
  const accidentCount = sortedActivities.filter((activity) => activity.pottyLocation === 'indoor_accident').length;
  const foodActivities = sortedActivities.filter((activity) => activity.type === 'food');
  const totalMeals = foodActivities.length;
  const totalFoodGrams = foodActivities.reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0);
  const peesCount = sortedActivities.filter((activity) => activity.type === 'pee').length;
  const poopsCount = sortedActivities.filter((activity) => activity.type === 'poop').length;

  const breedLabel = formatBreedName(profile?.breed || 'Puppy', lang);
  const foodGoalLabel = profile?.dailyFoodGramGoal
    ? `${profile.dailyFoodGramGoal}g / ${isFrench ? 'jour' : 'day'} (${profile.targetMealsPerDay || 3} ${isFrench ? 'repas' : 'meals'})`
    : '-';

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'pee':
        return `<span class="badge badge-sky">💧 ${isFrench ? 'Pipi' : 'Pee'}</span>`;
      case 'poop':
        return `<span class="badge badge-amber">💩 ${isFrench ? 'Caca' : 'Poop'}</span>`;
      case 'food':
        return `<span class="badge badge-purple">🥣 ${isFrench ? 'Repas' : 'Meal'}</span>`;
      case 'weight':
        return `<span class="badge badge-pink">⚖️ ${isFrench ? 'Poids' : 'Weight'}</span>`;
      case 'medication':
        return `<span class="badge badge-teal">💊 ${isFrench ? 'Médicament' : 'Meds'}</span>`;
      default:
        return `<span class="badge badge-slate">${type}</span>`;
    }
  };

  const html = `
    <!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <title>${profile.name} - ${isFrench ? "Rapport d'Activités & Propreté" : 'Activity & Potty Report'}</title>
        <style>
          @page { size: A4; margin: 12mm 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 16px;
            color: #0f172a;
            line-height: 1.45;
            background: #ffffff;
            margin: 0;
          }
          .header {
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 14px;
            margin-bottom: 18px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .title-area h1 {
            margin: 0 0 4px 0;
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
          }
          .title-area p {
            margin: 0;
            font-size: 13px;
            color: #64748b;
          }
          .brand-tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            background: #eef2ff;
            color: #4338ca;
            border: 1px solid #c7d2fe;
          }
          .grid-summary {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            text-align: center;
          }
          .card-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .card-value {
            font-size: 17px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          .card-sub {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 1px;
          }
          .info-panel {
            background: #f1f5f9;
            border-left: 4px solid #4f46e5;
            border-radius: 0 8px 8px 0;
            padding: 10px 14px;
            margin-bottom: 18px;
            font-size: 12px;
            color: #334155;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
          }
          .info-panel strong {
            color: #0f172a;
          }
          h2 {
            font-size: 15px;
            font-weight: 800;
            color: #1e1b4b;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin: 20px 0 10px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 11.5px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 7px 10px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f1f5f9;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 5px;
            font-size: 10.5px;
            font-weight: 700;
            white-space: nowrap;
          }
          .badge-sky { background: #e0f2fe; color: #0369a1; }
          .badge-amber { background: #fef3c7; color: #92400e; }
          .badge-purple { background: #f3e8ff; color: #6b21a8; }
          .badge-pink { background: #fce7f3; color: #9d174d; }
          .badge-teal { background: #ccfbf1; color: #115e59; }
          .badge-slate { background: #f1f5f9; color: #475569; }
          .pill-loc {
            display: inline-block;
            font-size: 10px;
            font-weight: 600;
            padding: 1px 5px;
            border-radius: 4px;
          }
          .loc-outside { background: #dcfce7; color: #166534; }
          .loc-accident { background: #fee2e2; color: #991b1b; }
          .caretaker-badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            color: #475569;
            background: #f1f5f9;
            padding: 1px 6px;
            border-radius: 4px;
          }
          .notes-cell {
            color: #475569;
            font-style: italic;
            word-break: break-word;
          }
          .footer {
            margin-top: 26px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 10.5px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>🐾 ${profile.name} — ${isFrench ? "Rapport d'Activités & Propreté" : 'Activity & Potty Report'}</h1>
            <p>${isFrench ? 'Édité le' : 'Generated on'} ${generatedDate}</p>
          </div>
          <span class="brand-tag">PupPace &bull; Smart Activity Log</span>
        </div>

        <div class="info-panel">
          <div><strong>${isFrench ? 'Chien :' : 'Dog:'}</strong> ${profile.name}</div>
          <div><strong>${isFrench ? 'Race :' : 'Breed:'}</strong> ${breedLabel}</div>
          <div><strong>${isFrench ? 'Date de naissance :' : 'Birth Date:'}</strong> ${profile.birthDate || '-'}</div>
          <div><strong>${isFrench ? 'Objectif Repas :' : 'Food Goal:'}</strong> ${foodGoalLabel}</div>
        </div>

        <div class="grid-summary">
          <div class="card">
            <div class="card-label">${isFrench ? 'Événements' : 'Total Logs'}</div>
            <div class="card-value">${totalLogs}</div>
            <div class="card-sub">${peesCount} ${isFrench ? 'pipis' : 'pees'}, ${poopsCount} ${isFrench ? 'cacas' : 'poops'}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Dehors' : 'Outside'}</div>
            <div class="card-value" style="color: #16a34a;">${outsideCount}</div>
            <div class="card-sub">${isFrench ? 'Réussites' : 'Successes'}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Accidents' : 'Accidents'}</div>
            <div class="card-value" style="color: #dc2626;">${accidentCount}</div>
            <div class="card-sub">${isFrench ? 'Intérieur' : 'Indoors'}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Repas' : 'Meals'}</div>
            <div class="card-value" style="color: #7c3aed;">${totalMeals}</div>
            <div class="card-sub">${totalFoodGrams}g ${isFrench ? 'total' : 'logged'}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Taux Réussite' : 'Potty Rate'}</div>
            <div class="card-value" style="color: #4f46e5;">
              ${(outsideCount + accidentCount) > 0 ? Math.round((outsideCount / (outsideCount + accidentCount)) * 100) : 100}%
            </div>
            <div class="card-sub">${isFrench ? 'Propreté' : 'Clean Score'}</div>
          </div>
        </div>

        <h2>
          <span>${isFrench ? 'Historique Détaillé des Événements' : 'Detailed Activity Log'}</span>
          <span style="font-size: 11px; font-weight: normal; color: #64748b;">${totalLogs} ${isFrench ? 'entrées' : 'entries'}</span>
        </h2>

        ${sortedActivities.length === 0 ? `
          <p style="text-align: center; color: #94a3b8; padding: 24px;">${isFrench ? 'Aucune activité enregistrée.' : 'No activity logs found.'}</p>
        ` : `
          <table>
            <thead>
              <tr>
                <th style="width: 130px;">${isFrench ? 'Date & Heure' : 'Date & Time'}</th>
                <th style="width: 85px;">${isFrench ? 'Type' : 'Type'}</th>
                <th>${isFrench ? 'Détails' : 'Details'}</th>
                <th style="width: 100px;">${isFrench ? 'Membre' : 'Logged By'}</th>
                <th>${isFrench ? 'Notes' : 'Notes'}</th>
              </tr>
            </thead>
            <tbody>
              ${sortedActivities.map((activity) => {
                const dateStr = new Date(activity.timestamp).toLocaleString(locale, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const caretakerName = resolveCaretakerName(activity.loggedBy, caretakers);

                const details: string[] = [];
                if (activity.pottyLocation === 'outside') {
                  details.push(`<span class="pill-loc loc-outside">🌳 ${isFrench ? 'Dehors' : 'Outside'}</span>`);
                } else if (activity.pottyLocation === 'indoor_accident') {
                  details.push(`<span class="pill-loc loc-accident">⚠️ ${isFrench ? 'Accident Intérieur' : 'Indoor Accident'}</span>`);
                }

                if (activity.stoolConsistency) {
                  details.push(`<span>${isFrench ? 'Selles :' : 'Stool:'} ${activity.stoolConsistency}</span>`);
                }

                if (activity.quantityGrams) {
                  details.push(`<strong>${activity.quantityGrams}g</strong>${activity.quantityCups ? ` (${activity.quantityCups} cups)` : ''}`);
                }

                if (activity.weightKg) {
                  details.push(`<strong>${activity.weightKg} kg</strong>`);
                }

                if (activity.medicationName) {
                  details.push(`💊 ${activity.medicationName}`);
                }

                if (activity.durationMinutes) {
                  details.push(`${activity.durationMinutes} min`);
                }

                return `
                  <tr>
                    <td><strong>${dateStr}</strong></td>
                    <td>${getTypeBadge(activity.type)}</td>
                    <td>${details.join(' &bull; ') || '-'}</td>
                    <td><span class="caretaker-badge">${caretakerName}</span></td>
                    <td class="notes-cell">${activity.notes ? `"${activity.notes}"` : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}

        <div class="footer">
          ${isFrench
            ? 'Document généré via PupPace — Suivi Intelligent des Besoins & Carnet Familial du Chiot.'
            : 'Document generated with PupPace — Smart Puppy Care & Potty Predictor.'}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  windowPrint.document.write(html);
  windowPrint.document.close();
  return true;
}

/**
 * Exports puppy veterinary and health passport records to a formatted CSV file with UTF-8 BOM.
 */
export function exportHealthPassportToCSV(
  profile: PuppyProfile,
  vaccinations: HealthRecord[],
  dewormings: HealthRecord[],
  activities: Activity[] = [],
  lang: 'en' | 'fr' = 'fr',
  caretakers: Caretaker[] = []
): boolean {
  if (!profile) return false;

  const isFrench = lang === 'fr';
  const tz = getUserTimezone();

  const headers = isFrench
    ? [
        'Catégorie',
        'Date',
        'Protocole / Produit / Mesure',
        'Prochain Rappel / Échéance',
        'Poids (kg)',
        'Clinique Vétérinaire',
        'N° Lot / Flacon',
        'Enregistré Par',
        'Notes',
      ]
    : [
        'Category',
        'Date',
        'Protocol / Product / Measurement',
        'Next Due / Booster Date',
        'Weight (kg)',
        'Veterinary Clinic',
        'Batch / Lot Number',
        'Logged By',
        'Notes',
      ];

  const rows: string[] = [];

  // 1. Vaccinations
  const sortedVaccines = [...vaccinations].sort(
    (vaccineA, vaccineB) => new Date(vaccineB.date).getTime() - new Date(vaccineA.date).getTime()
  );
  sortedVaccines.forEach((vaccine) => {
    rows.push([
      escapeCsvField(isFrench ? 'Vaccination' : 'Vaccination'),
      escapeCsvField(vaccine.date),
      escapeCsvField(vaccine.name),
      escapeCsvField(vaccine.boosterDate || ''),
      escapeCsvField(vaccine.weightAtTime ?? ''),
      escapeCsvField(vaccine.vetClinic || (isFrench ? 'Clinique Vétérinaire' : 'Veterinary Clinic')),
      escapeCsvField(vaccine.batchNumber || ''),
      escapeCsvField(''),
      escapeCsvField(vaccine.notes || ''),
    ].join(','));
  });

  // 2. Deworming & Antiparasitics
  const sortedDewormings = [...dewormings].sort(
    (dewormingA, dewormingB) => new Date(dewormingB.date).getTime() - new Date(dewormingA.date).getTime()
  );
  sortedDewormings.forEach((deworming) => {
    rows.push([
      escapeCsvField(isFrench ? 'Vermifuge / Antiparasitaire' : 'Deworming / Antiparasitic'),
      escapeCsvField(deworming.date),
      escapeCsvField(deworming.productName || deworming.name),
      escapeCsvField(deworming.boosterDate || ''),
      escapeCsvField(deworming.weightAtTime ?? ''),
      escapeCsvField(deworming.vetClinic || ''),
      escapeCsvField(deworming.batchNumber || ''),
      escapeCsvField(''),
      escapeCsvField(deworming.notes || ''),
    ].join(','));
  });

  // 3. Weight Records
  const weightLogs = activities
    .filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
    .sort((activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime());

  weightLogs.forEach((weightItem) => {
    const formattedDate = formatLogicalDate(weightItem.timestamp, tz);
    const resolvedCaretaker = resolveCaretakerName(weightItem.loggedBy, caretakers);
    rows.push([
      escapeCsvField(isFrench ? 'Pesée & Croissance' : 'Weight & Growth'),
      escapeCsvField(formattedDate),
      escapeCsvField(isFrench ? 'Contrôle du Poids' : 'Weight Measurement'),
      escapeCsvField(''),
      escapeCsvField(weightItem.weightKg ?? ''),
      escapeCsvField(''),
      escapeCsvField(''),
      escapeCsvField(resolvedCaretaker),
      escapeCsvField(weightItem.notes || ''),
    ].join(','));
  });

  const escapedHeaders = headers.map(escapeCsvField).join(',');
  const csvContent = '\uFEFF' + [escapedHeaders, ...rows].join('\r\n');
  const safeDogName = (profile?.name || 'puppy').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  downloadCsvFile(csvContent, `${safeDogName}_carnet_de_sante_${formatLocalDate()}.csv`);

  return true;
}

/**
 * Opens a print-optimized window for the Veterinary Health Passport.
 */
export function printHealthPassportReport(
  profile: PuppyProfile,
  vaccinations: HealthRecord[],
  dewormings: HealthRecord[],
  activities: Activity[] = [],
  lang: 'en' | 'fr' = 'fr',
  _t?: TranslationKeys
): boolean {
  if (typeof window === 'undefined') return false;

  const windowPrint = window.open('', '', 'width=900,height=1000');
  if (!windowPrint) return false;

  const isFrench = lang === 'fr';
  const locale = isFrench ? 'fr-FR' : 'en-US';
  const generatedDate = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sortedVaccines = [...vaccinations].sort(
    (vaccineA, vaccineB) => new Date(vaccineB.date).getTime() - new Date(vaccineA.date).getTime()
  );
  const sortedDewormings = [...dewormings].sort(
    (dewormingA, dewormingB) => new Date(dewormingB.date).getTime() - new Date(dewormingA.date).getTime()
  );
  const weightLogs = activities
    .filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
    .sort((activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime());

  const latestWeight = weightLogs.length > 0 ? weightLogs[0].weightKg : (profile.weightKg || '-');
  const breedLabel = formatBreedName(profile?.breed || 'Puppy', lang);

  const html = `
    <!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <title>${profile.name} - ${isFrench ? 'Carnet de Santé Vétérinaire' : 'Veterinary Health Passport'}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 20px;
            color: #0f172a;
            line-height: 1.4;
            background: #ffffff;
            margin: 0;
          }
          .header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 14px;
            margin-bottom: 18px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .title-area h1 {
            margin: 0 0 4px 0;
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
          }
          .title-area p {
            margin: 0;
            font-size: 13px;
            color: #64748b;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: bold;
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
          }
          .grid-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
          }
          .card-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .card-value {
            font-size: 16px;
            font-weight: bold;
            color: #0f172a;
            margin-top: 2px;
          }
          h2 {
            font-size: 15px;
            color: #0369a1;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin: 20px 0 10px 0;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 7px 10px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
            font-size: 11px;
            text-transform: uppercase;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>🐾 ${isFrench ? 'Carnet de Santé & Passeport Vaccinal' : 'Health Passport & Vaccine Record'} — ${profile.name}</h1>
            <p>${isFrench ? 'Dossier Médical Vétérinaire' : 'Veterinary Medical File'} &bull; ${breedLabel} &bull; ${isFrench ? 'Édité le' : 'Generated on'} ${generatedDate}</p>
          </div>
          <span class="badge">PupPace Health Passport</span>
        </div>

        <div class="grid-summary">
          <div class="card">
            <div class="card-label">${isFrench ? 'Nom du Chien' : 'Dog Name'}</div>
            <div class="card-value">${profile.name}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Race' : 'Breed'}</div>
            <div class="card-value">${breedLabel}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Date de Naissance' : 'Birth Date'}</div>
            <div class="card-value">${profile.birthDate || '-'}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Dernier Poids Connu' : 'Latest Known Weight'}</div>
            <div class="card-value">${latestWeight} kg</div>
          </div>
        </div>

        <h2>💉 ${isFrench ? 'Historique des Vaccinations & Rappels WSAVA' : 'Vaccination History & WSAVA Boosters'}</h2>
        ${sortedVaccines.length === 0 ? `<p style="font-size:12px;color:#64748b;">${isFrench ? 'Aucun vaccin enregistré.' : 'No vaccine records logged.'}</p>` : `
        <table>
          <thead>
            <tr>
              <th>${isFrench ? 'Date Injection' : 'Injection Date'}</th>
              <th>${isFrench ? 'Protocole Vaccinal' : 'Vaccine Protocol'}</th>
              <th>${isFrench ? 'Prochain Rappel' : 'Next Booster'}</th>
              <th>${isFrench ? 'Clinique Vétérinaire' : 'Veterinary Clinic'}</th>
              <th>${isFrench ? 'N° Lot / Flacon' : 'Batch / Lot #'}</th>
            </tr>
          </thead>
          <tbody>
            ${sortedVaccines.map((vaccine) => `
              <tr>
                <td><strong>${vaccine.date}</strong></td>
                <td>${vaccine.name}</td>
                <td>${vaccine.boosterDate || '-'}</td>
                <td>${vaccine.vetClinic || (isFrench ? 'Clinique Vétérinaire' : 'Veterinary Clinic')}</td>
                <td>${vaccine.batchNumber || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}

        <h2>💊 ${isFrench ? 'Historique Vermifuge & Parasitologie (Protocole ESCCAP)' : 'Deworming & Parasitology History (ESCCAP Protocol)'}</h2>
        ${sortedDewormings.length === 0 ? `<p style="font-size:12px;color:#64748b;">${isFrench ? 'Aucun traitement vermifuge enregistré.' : 'No deworming treatments logged.'}</p>` : `
        <table>
          <thead>
            <tr>
              <th>${isFrench ? 'Date Administration' : 'Date Given'}</th>
              <th>${isFrench ? 'Produit Antiparasitaire' : 'Product Name'}</th>
              <th>${isFrench ? 'Poids au Traitement' : 'Weight at time'}</th>
              <th>${isFrench ? 'Prochain Traitement Dû' : 'Next Due Date'}</th>
            </tr>
          </thead>
          <tbody>
            ${sortedDewormings.map((deworming) => `
              <tr>
                <td><strong>${deworming.date}</strong></td>
                <td>${deworming.productName || deworming.name}</td>
                <td>${deworming.weightAtTime ? `${deworming.weightAtTime} kg` : '-'}</td>
                <td>${deworming.boosterDate || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}

        <h2>⚖️ ${isFrench ? 'Historique des Pesées & Croissance' : 'Weight History & Growth Curve'}</h2>
        ${weightLogs.length === 0 ? `<p style="font-size:12px;color:#64748b;">${isFrench ? 'Aucune pesée enregistrée.' : 'No weight entries logged.'}</p>` : `
        <table>
          <thead>
            <tr>
              <th>${isFrench ? 'Date & Heure' : 'Date & Time'}</th>
              <th>${isFrench ? 'Poids (kg)' : 'Weight (kg)'}</th>
              <th>${isFrench ? 'Enregistré Par' : 'Logged By'}</th>
              <th>${isFrench ? 'Notes / Remarques' : 'Notes'}</th>
            </tr>
          </thead>
          <tbody>
            ${weightLogs.slice(0, 15).map((weightItem) => `
              <tr>
                <td>${new Date(weightItem.timestamp).toLocaleDateString(locale)}</td>
                <td><strong>${weightItem.weightKg} kg</strong></td>
                <td>${weightItem.loggedBy}</td>
                <td>${weightItem.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}

        <div class="footer">
          ${isFrench
            ? 'Document généré via PupPace — Application de Suivi & Carnet de Santé Familial du Chiot.'
            : 'Document generated with PupPace — Family Puppy Care & Health Passport.'}
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `;

  windowPrint.document.write(html);
  windowPrint.document.close();
  return true;
}


