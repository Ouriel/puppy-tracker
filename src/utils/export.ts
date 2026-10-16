import type { Activity, PuppyProfile, Caretaker, HealthRecord } from '../types';
import type { TranslationKeys } from '../i18n/types';
import { formatLocalDate, formatLocalTime, parseIsoDate, formatLogicalDate, getUserTimezone } from './date';
import { resolveCaretakerName } from './caretakers';
import { formatBreedName } from '../data/breedsCatalog';
import { formatGrams, formatKg } from './weight';
import { buildDogWeightChart, getWeightChartModel, type WeightChartGeometry } from './weightChartGeometry';
import { formatProductAndLot, getHealthRecordStatus, getNextDue, getRecordShortName } from './health';
import { getPuppyAge } from './predictions';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';

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

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes a user-controlled value before interpolating it into print-report HTML. */
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** Quotes a CSV cell. Text starting with = + - @ gets a leading ' so a spreadsheet never runs it as a formula (OWASP); numbers stay numbers. */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const trimmedValue = String(value).trim();
  // Checked after trim(), which already drops a leading tab, CR, LF or space
  const safeValue = typeof value === 'string' && /^[=+\-@]/.test(trimmedValue) ? `'${trimmedValue}` : trimmedValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
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
        'Type d\'activité',
        'Lieu besoins',
        'Consistance selles',
        'Quantité (g)',
        'Quantité (verres)',
        'Durée (min)',
        'Poids (kg)',
        'Médicament',
        'Enregistré par',
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
    if (location === 'indoor_accident') return isFrench ? 'Accident intérieur' : 'Indoor Accident';
    return location;
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
      // The log form's words: 'Molles', 'Diarrhée'
      escapeCsvField(activity.stoolConsistency ? (isFrench ? fr : en).potty[activity.stoolConsistency] : ''),
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
 * Writes the report into the print window and prints it from here once it has loaded:
 * the about:blank window inherits the app's Content-Security-Policy, which runs no inline script.
 * The listener goes after write(), which opens a new document and drops the window's listeners,
 * and before close(), which can fire load synchronously.
 */
function writeAndPrint(windowPrint: Window, html: string): void {
  windowPrint.document.write(html);
  windowPrint.addEventListener('load', () => windowPrint.print(), { once: true });
  windowPrint.document.close();
}

/**
 * Opens a print-optimized window for the Puppy Activity Timeline and triggers browser PDF/print dialog.
 */
export function printActivitiesReport(
  activities: Activity[],
  profile: PuppyProfile,
  lang: 'en' | 'fr' = 'fr',
  t: TranslationKeys,
  caretakers: Caretaker[],
  /** The first and last day the feed shows (YYYY-MM-DD) */
  period: { from: string; to: string }
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
  const formatDay = (dateKey: string) =>
    new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const periodLabel = isFrench
    ? `Du ${formatDay(period.from)} au ${formatDay(period.to)}`
    : `From ${formatDay(period.from)} to ${formatDay(period.to)}`;

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
        return `<span class="badge badge-slate">${esc(type)}</span>`;
    }
  };

  const html = `
    <!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <title>${esc(profile.name)} - ${isFrench ? "Rapport d'activités & propreté" : 'Activity & Potty Report'}</title>
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
            white-space: nowrap;
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
            <h1>🐾 ${esc(profile.name)} — ${isFrench ? "Rapport d'activités & propreté" : 'Activity & Potty Report'}</h1>
            <p><strong>${esc(periodLabel)}</strong></p>
            <p>${isFrench ? 'Édité le' : 'Generated on'} ${generatedDate}</p>
          </div>
          <span class="brand-tag">${esc(t.brand)}</span>
        </div>

        <div class="info-panel">
          <div><strong>${isFrench ? 'Chien :' : 'Dog:'}</strong> ${esc(profile.name)}</div>
          <div><strong>${isFrench ? 'Race :' : 'Breed:'}</strong> ${esc(breedLabel)}</div>
          <div><strong>${isFrench ? 'Date de naissance :' : 'Birth Date:'}</strong> ${esc(profile.birthDate || '-')}</div>
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
            <div class="card-sub">${totalFoodGrams > 0 ? `${formatGrams(totalFoodGrams, lang)} ${isFrench ? 'total' : 'logged'}` : ''}</div>
          </div>
          <div class="card">
            <div class="card-label">${isFrench ? 'Taux de réussite' : 'Potty Rate'}</div>
            <div class="card-value" style="color: #4f46e5;">
              ${(outsideCount + accidentCount) > 0 ? Math.round((outsideCount / (outsideCount + accidentCount)) * 100) : 100}%
            </div>
            <div class="card-sub">${isFrench ? 'Propreté' : 'Clean Score'}</div>
          </div>
        </div>

        <h2>
          <span>${isFrench ? 'Historique détaillé des événements' : 'Detailed Activity Log'}</span>
          <span style="font-size: 11px; font-weight: normal; color: #64748b;">${totalLogs} ${isFrench ? 'entrées' : 'entries'}</span>
        </h2>

        ${sortedActivities.length === 0 ? `
          <p style="text-align: center; color: #94a3b8; padding: 24px;">${isFrench ? 'Aucune activité enregistrée.' : 'No activity logs found.'}</p>
        ` : `
          <table>
            <thead>
              <tr>
                <th style="width: 130px;">${isFrench ? 'Date et heure' : 'Date & Time'}</th>
                <th style="width: 85px;">${isFrench ? 'Type' : 'Type'}</th>
                <th>${isFrench ? 'Détails' : 'Details'}</th>
                <th style="width: 100px;">${isFrench ? 'Membre' : 'Logged By'}</th>
                <th style="width: 160px;">${isFrench ? 'Notes' : 'Notes'}</th>
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
                  details.push(`<span class="pill-loc loc-accident">⚠️ ${isFrench ? 'Accident intérieur' : 'Indoor Accident'}</span>`);
                }

                if (activity.stoolConsistency) {
                  details.push(`<span>${t.potty.stoolConsistencyPrefix}${t.common.colon} ${esc(t.potty[activity.stoolConsistency])}</span>`);
                }

                if (activity.quantityGrams) {
                  const cups = activity.quantityCups ? ` (${new Intl.NumberFormat(locale).format(activity.quantityCups)} ${t.units.cups})` : '';
                  details.push(`<strong>${formatGrams(activity.quantityGrams, lang)}</strong>${esc(cups)}`);
                }

                if (activity.weightKg) {
                  details.push(`<strong>${formatKg(activity.weightKg, lang)}</strong>`);
                }

                if (activity.medicationName) {
                  details.push(`💊 ${esc(activity.medicationName)}`);
                }

                if (activity.durationMinutes) {
                  details.push(`${esc(activity.durationMinutes)} min`);
                }

                return `
                  <tr>
                    <td><strong>${dateStr}</strong></td>
                    <td>${getTypeBadge(activity.type)}</td>
                    <td>${details.join(' &bull; ') || '-'}</td>
                    <td><span class="caretaker-badge">${esc(caretakerName)}</span></td>
                    <td class="notes-cell">${activity.notes ? `&quot;${esc(activity.notes)}&quot;` : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}

        <div class="footer">
          ${isFrench
            ? 'Document généré avec PupPace — suivi des besoins et carnet de santé du chiot.'
            : 'Document generated with PupPace — Smart Puppy Care & Potty Predictor.'}
        </div>
      </body>
    </html>
  `;

  writeAndPrint(windowPrint, html);
  return true;
}

/**
 * Exports the health passport to a CSV file with UTF-8 BOM: vaccines, dewormings, weigh-ins and treatments, each its own row.
 */
export function exportHealthPassportToCSV(
  profile: PuppyProfile,
  vaccinations: HealthRecord[],
  dewormings: HealthRecord[],
  /** The dog's weight and medication events */
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
        'Heure',
        'Protocole / produit / mesure',
        'Prochain rappel / échéance',
        'Poids (kg)',
        'Clinique vétérinaire',
        'Produit (vignette)',
        'N° lot / flacon',
        'Enregistré par',
        'Notes',
      ]
    : [
        'Category',
        'Date',
        'Time',
        'Protocol / Product / Measurement',
        'Next Due / Booster Date',
        'Weight (kg)',
        'Veterinary Clinic',
        'Product (Sticker)',
        'Batch / Lot Number',
        'Logged By',
        'Notes',
      ];

  const rows: string[] = [];
  const byDateDesc = (recordA: HealthRecord, recordB: HealthRecord) => new Date(recordB.date).getTime() - new Date(recordA.date).getTime();

  // 1. Vaccinations: the product typed from the vet's sticker has its own column
  [...vaccinations].sort(byDateDesc).forEach((vaccine) => {
    rows.push([
      escapeCsvField('Vaccination'),
      escapeCsvField(vaccine.date),
      escapeCsvField(''),
      escapeCsvField(vaccine.name),
      escapeCsvField(vaccine.boosterDate || ''),
      // A weigh-in is its own weight event, listed below: a record never holds a weight
      escapeCsvField(''),
      escapeCsvField(vaccine.vetClinic || ''),
      escapeCsvField(vaccine.productName || ''),
      escapeCsvField(vaccine.batchNumber || ''),
      escapeCsvField(''),
      escapeCsvField(vaccine.notes || ''),
    ].join(','));
  });

  // 2. Deworming & Antiparasitics: the product is the record's name
  [...dewormings].sort(byDateDesc).forEach((deworming) => {
    rows.push([
      escapeCsvField(isFrench ? 'Vermifuge / antiparasitaire' : 'Deworming / Antiparasitic'),
      escapeCsvField(deworming.date),
      escapeCsvField(''),
      escapeCsvField(deworming.productName || deworming.name),
      escapeCsvField(deworming.boosterDate || ''),
      escapeCsvField(''),
      escapeCsvField(deworming.vetClinic || ''),
      escapeCsvField(''),
      escapeCsvField(deworming.batchNumber || ''),
      escapeCsvField(''),
      escapeCsvField(deworming.notes || ''),
    ].join(','));
  });

  // 3. Weigh-ins, then treatments, newest first, on their calendar day as on screen and in the print (a 01:30 dose is not the day before's)
  const events = [...activities].sort((activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime());
  const eventRow = (activity: Activity, category: string, label: string, weightKg: number | string) => [
    escapeCsvField(category),
    escapeCsvField(formatLocalDate(new Date(activity.timestamp), tz)),
    escapeCsvField(formatLocalTime(new Date(activity.timestamp), tz)),
    escapeCsvField(label),
    escapeCsvField(''),
    escapeCsvField(weightKg),
    escapeCsvField(''),
    escapeCsvField(''),
    escapeCsvField(''),
    escapeCsvField(resolveCaretakerName(activity.loggedBy, caretakers)),
    escapeCsvField(activity.notes || ''),
  ].join(',');

  events
    .filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
    .forEach((weightItem) => rows.push(eventRow(weightItem, isFrench ? 'Pesée & croissance' : 'Weight & Growth', isFrench ? 'Contrôle du poids' : 'Weight Measurement', weightItem.weightKg ?? '')));
  events
    .filter((activity) => activity.type === 'medication')
    .forEach((medication) => rows.push(eventRow(medication, isFrench ? 'Traitement' : 'Treatment', medication.medicationName || '', '')));

  const escapedHeaders = headers.map(escapeCsvField).join(',');
  const csvContent = '\uFEFF' + [escapedHeaders, ...rows].join('\r\n');
  const safeDogName = (profile?.name || 'puppy').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  downloadCsvFile(csvContent, `${safeDogName}_carnet_de_sante_${formatLocalDate()}.csv`);

  return true;
}

/** The printed passport fits one A4 page: each section keeps its latest rows (vaccines: the open ones first), the rest is counted as "n antérieurs". */
const PRINT_CAPS = { toDo: 6, vaccines: 6, dewormings: 8, treatments: 8, weighIns: 12 } as const;
const PRINT_CHART_WIDTH = 420;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Long notes are cut, with an ellipsis, so they never push the page past one sheet. */
function cutText(text: string | null | undefined, maxLength: number): string {
  const trimmed = (text ?? '').trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…` : trimmed;
}

/** DD/MM/YYYY: a calendar date ('2026-09-27') as it is, a timestamp on this device's day. */
function formatDayMonthYear(date: string): string {
  const [year, month, day] = (date.length === 10 ? date : formatLocalDate(new Date(date))).split('-');
  return `${day}/${month}/${year}`;
}

/** The passport's weight curve as an SVG string: the screen chart's geometry, in print colours. */
function weightChartSvg(geometry: WeightChartGeometry, adultLabel: string, t: TranslationKeys): string {
  const { plot, height } = geometry;
  const yTicks = geometry.yTicks.map((tick, index) =>
    `<line x1="${plot.left}" x2="${plot.right}" y1="${tick.y}" y2="${tick.y}" stroke="#e2e8f0"/>`
    + `<text x="${plot.left - 6}" y="${tick.y + 4}" text-anchor="end">${index === geometry.yTicks.length - 1 ? `${tick.kg} kg` : tick.kg}</text>`).join('');
  const xTicks = geometry.xTicks.map((tick, index) =>
    `<text x="${tick.x}" y="${height - 8}" text-anchor="${tick.anchor}">${index === geometry.xTicks.length - 1 ? t.weightChart.monthsOld.replace('{months}', String(tick.months)) : tick.months}</text>`).join('');
  const points = geometry.points.map((point) => (point.isUnlikely
    ? `<circle data-weigh-in cx="${point.x}" cy="${point.y}" r="5" fill="#ffffff" stroke="#d97706" stroke-width="2"/><text x="${point.x}" y="${point.y + 4}" text-anchor="middle" fill="#d97706" font-weight="800" font-size="10">!</text>`
    : `<circle data-weigh-in cx="${point.x}" cy="${point.y}" r="3" fill="#db2777" stroke="#ffffff" stroke-width="1"/>`)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_CHART_WIDTH}" height="${height}" font-size="11" fill="#475569">
    <defs><clipPath id="plot"><rect x="${plot.left}" y="0" width="${plot.right - plot.left}" height="${plot.bottom + 2}"/></clipPath></defs>
    ${yTicks}${xTicks}
    <g clip-path="url(#plot)">
      ${geometry.bandPath ? `<path d="${geometry.bandPath}" fill="#94a3b8" fill-opacity="0.25"/>` : ''}
      ${geometry.bandMidPath ? `<path d="${geometry.bandMidPath}" fill="none" stroke="#94a3b8"/>` : ''}
      ${geometry.projectionPath ? `<path d="${geometry.projectionPath}" fill="none" stroke="#db2777" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="5 4"/>` : ''}
      ${geometry.linePath ? `<path data-line d="${geometry.linePath}" fill="none" stroke="#db2777" stroke-width="2" stroke-linejoin="round"/>` : ''}
    </g>
    <line x1="${geometry.today.x}" x2="${geometry.today.x}" y1="${plot.top}" y2="${plot.bottom}" stroke="#cbd5e1"/>
    <text x="${geometry.today.x}" y="${plot.top - 3}" text-anchor="middle">${t.weightChart.todayShort}</text>
    ${geometry.projectionEnd ? `<text x="${plot.right}" y="${geometry.projectionEnd.labelY}" text-anchor="end">${adultLabel}</text>` : ''}
    ${geometry.today.estimateY !== null ? `<circle cx="${geometry.today.x}" cy="${geometry.today.estimateY}" r="4" fill="#ffffff" stroke="#db2777" stroke-width="2"/>` : ''}
    ${points}
  </svg>`;
}

/**
 * Opens a one-page A4 summary of the health passport for a vet, a pension or a sitter (carnet review phase 4):
 * the dog, what is due, vaccines, the last 12 months of dewormings, the last 90 days of treatments and the weight curve.
 * Marked unofficial: it never replaces the vet's own record.
 */
export function printHealthPassportReport(
  profile: PuppyProfile,
  vaccinations: HealthRecord[],
  dewormings: HealthRecord[],
  /** The dog's weight and medication events */
  activities: Activity[] = [],
  lang: 'en' | 'fr' = 'fr'
): boolean {
  if (typeof window === 'undefined') return false;

  const windowPrint = window.open('', '', 'width=900,height=1000');
  if (!windowPrint) return false;

  const isFrench = lang === 'fr';
  const t = isFrench ? fr : en;
  const today = formatLocalDate();
  const title = isFrench ? 'Carnet de santé — résumé (document non officiel)' : 'Health record — summary (unofficial document)';
  const earlierLine = (count: number) => (count === 0 ? '' : `<p class="earlier">${isFrench ? `${count} antérieur${count > 1 ? 's' : ''}` : `${count} earlier`}</p>`);
  // Every cell holds one line, cut with an ellipsis, and notes one line under their row: no row grows with what was typed
  const noteRow = (notes: string | null | undefined, columns: number) =>
    (notes?.trim() ? `<tr class="note"><td colspan="${columns}">${esc(cutText(notes, 140))}</td></tr>` : '');
  const byDateDesc = (recordA: HealthRecord, recordB: HealthRecord) => recordB.date.localeCompare(recordA.date);

  // Header: the dog, its age today, its latest weight (never the profile weight: legacy, an older dog's is a made-up 4.5 kg)
  const age = getPuppyAge(profile.birthDate);
  const ageText = age.weeks < 16 ? t.weightChart.weeksOld.replace('{weeks}', String(age.weeks)) : t.weightChart.monthsOld.replace('{months}', String(Math.floor(age.months)));
  const weightModel = getWeightChartModel(activities, profile);
  const latestTrusted = weightModel.trusted.at(-1);
  const identity = [
    `<strong>${esc(profile.name)}</strong>`,
    profile.gender && (profile.gender === 'female' ? t.puppies.female : t.puppies.male),
    esc(formatBreedName(profile.breed || 'Puppy', lang)),
    `${isFrench ? 'Naissance' : 'Born'}${t.common.colon} ${esc(formatDayMonthYear(profile.birthDate))} (${ageText})`,
    latestTrusted && `${t.weightChart.title}${t.common.colon} ${formatKg(latestTrusted.weightKg, lang)} (${formatDayMonthYear(latestTrusted.timestamp)})`,
  ].filter(Boolean).join(' · ');
  const dogNotes = cutText(profile.notes, 300);

  // "À faire": every open next date, overdue first, as on screen
  const dueItems = getNextDue([...vaccinations, ...dewormings]);
  const urgencyText: Record<string, string> = isFrench ? { overdue: 'en retard', soon: 'bientôt' } : { overdue: 'overdue', soon: 'soon' };
  const moreToDo = dueItems.length - PRINT_CAPS.toDo;
  const toDoRows = dueItems.slice(0, PRINT_CAPS.toDo).map(({ record, urgency }) => `
    <tr data-row><td>${esc(getRecordShortName(record, lang))}</td><td>${formatDayMonthYear(record.boosterDate!)}</td><td class="${urgency}">${urgencyText[urgency] ?? ''}</td></tr>`).join('');

  // Every open shot first (a rabies shot good for 3 years is what a kennel reads this page for), then the latest renewed ones
  const sortedVaccines = [...vaccinations].sort(byDateDesc);
  const isRenewed = (vaccine: HealthRecord) => getHealthRecordStatus(vaccine, vaccinations) === 'fulfilled';
  const shownVaccines = [...sortedVaccines.filter((vaccine) => !isRenewed(vaccine)), ...sortedVaccines.filter(isRenewed)]
    .slice(0, PRINT_CAPS.vaccines)
    .sort(byDateDesc);
  const vaccineRows = shownVaccines.map((vaccine) => `
    <tr data-row><td>${formatDayMonthYear(vaccine.date)}</td><td>${esc(getRecordShortName(vaccine, lang))}</td><td>${esc(formatProductAndLot(vaccine) || '-')}</td><td>${esc(vaccine.vetClinic?.trim() || '-')}</td><td>${vaccine.boosterDate ? formatDayMonthYear(vaccine.boosterDate) : '-'}</td></tr>${noteRow(vaccine.notes, 5)}`).join('');

  // The last 12 months
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const sortedDewormings = [...dewormings].sort(byDateDesc);
  const shownDewormings = sortedDewormings.filter((deworming) => deworming.date >= yearAgo).slice(0, PRINT_CAPS.dewormings);
  const dewormingRows = shownDewormings.map((deworming) => `
    <tr data-row><td>${formatDayMonthYear(deworming.date)}</td><td>${esc(deworming.productName || deworming.name)}</td><td>${deworming.boosterDate ? formatDayMonthYear(deworming.boosterDate) : '-'}</td></tr>${noteRow(deworming.notes, 3)}`).join('');

  // The last 90 days
  const medications = activities
    .filter((activity) => activity.type === 'medication')
    .sort((activityA, activityB) => Date.parse(activityB.timestamp) - Date.parse(activityA.timestamp));
  const shownMedications = medications.filter((medication) => Date.parse(medication.timestamp) >= Date.now() - NINETY_DAYS_MS).slice(0, PRINT_CAPS.treatments);
  const medicationRows = shownMedications.map((medication) => `
    <tr data-row><td>${formatDayMonthYear(medication.timestamp)}</td><td>${esc(medication.medicationName || t.potty.medication)}</td></tr>${noteRow(medication.notes, 2)}`).join('');

  // The curve, as on screen, and the last weigh-ins; one that looks like a typo is marked
  const { entries, unlikelyIds, projection } = weightModel;
  const geometry = buildDogWeightChart(weightModel, profile.birthDate, PRINT_CHART_WIDTH, false);
  const adultLabel = t.weightChart.adultEnd.replace('{weight}', formatKg(projection.projectedAdultKg, lang));
  // What the line and dots, the grey band and the dashed line are, shown as on screen: the band is only a rough guide
  const legendItem = (swatch: string, label: string) => `<span><svg width="14" height="8">${swatch}</svg>${label}</span>`;
  const legend = [
    legendItem('<line x1="0" x2="14" y1="4" y2="4" stroke="#db2777" stroke-width="2"/><circle cx="7" cy="4" r="2.5" fill="#db2777"/>', t.weightChart.legendWeighIns),
    geometry.bandPath && legendItem('<rect width="14" height="8" fill="#94a3b8" fill-opacity="0.25"/><line x1="0" x2="14" y1="4" y2="4" stroke="#94a3b8"/>', t.weightChart.legendZone),
    geometry.projectionPath && legendItem('<line x1="0" x2="14" y1="4" y2="4" stroke="#db2777" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="4 3"/>', t.weightChart.legendProjection),
  ].filter(Boolean).join('');
  const shownWeighIns = [...entries].reverse().slice(0, PRINT_CAPS.weighIns);
  const weighInRows = shownWeighIns.map((entry) => `
    <tr data-row><td>${formatDayMonthYear(entry.timestamp)}</td><td>${formatKg(entry.weightKg, lang)}${unlikelyIds.has(entry.id) ? ` (${t.weightChart.checkBadge})` : ''}</td></tr>`).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <title>${esc(profile.name)} — ${title}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
          }
          @media screen { body { max-width: 190mm; margin: 10mm auto; } }
          h1 { font-size: 16px; margin: 0 0 4px; }
          h2 { font-size: 12px; color: #0f766e; margin: 8px 0 2px; padding-bottom: 2px; border-bottom: 1px solid #e2e8f0; }
          p { margin: 2px 0; }
          .meta, .earlier { font-size: 10px; color: #64748b; }
          .dog-notes { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; line-height: 1.25; }
          th, td { text-align: left; vertical-align: top; padding: 1px 6px 1px 0; border-bottom: 1px solid #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          th { font-weight: 600; color: #475569; }
          col.date { width: 68px; }
          col.status { width: 64px; }
          tr[data-row]:has(+ tr.note) td { border-bottom: 0; }
          tr.note td { padding-left: 68px; font-style: italic; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .overdue { color: #b91c1c; font-weight: 700; }
          .soon { color: #b45309; font-weight: 700; }
          #to-do { margin-top: 6px; padding: 2px 8px 4px; border: 1.5px solid #0f766e; border-radius: 6px; }
          #to-do h2 { margin-top: 0; border: 0; }
          .columns { display: flex; gap: 16px; }
          .columns > section { flex: 1; min-width: 0; }
          .weight { display: flex; gap: 12px; align-items: flex-start; }
          .weight .chart { flex: none; }
          .legend { display: flex; flex-wrap: wrap; gap: 0 10px; margin: 0; font-size: 9.5px; color: #475569; }
          .legend span { display: inline-flex; align-items: center; gap: 4px; }
          .weight .list { flex: 1; min-width: 0; }
        </style>
      </head>
      <body>
        <section id="identity">
          <h1>${title}</h1>
          <p>${identity}</p>
          ${dogNotes ? `<p class="dog-notes">Notes${t.common.colon} ${esc(dogNotes)}</p>` : ''}
          <p class="meta">${isFrench
            ? `Édité le ${formatDayMonthYear(today)} avec PupPace. Il ne remplace pas le carnet de santé officiel.`
            : `Printed on ${formatDayMonthYear(today)} with PupPace. It does not replace the official health record.`}</p>
        </section>

        <section id="to-do">
          <h2>${t.health.toDo}</h2>
          ${toDoRows ? `<table><colgroup><col><col class="date"><col class="status"></colgroup><tbody>${toDoRows}</tbody></table>` : `<p>${t.health.nothingDue}</p>`}
          ${moreToDo > 0 ? `<p class="earlier">${isFrench ? `+ ${moreToDo} autre${moreToDo > 1 ? 's' : ''}` : `+ ${moreToDo} more`}</p>` : ''}
        </section>

        <section id="vaccines">
          <h2>${t.health.vaccinations}</h2>
          ${shownVaccines.length === 0 ? `<p>${t.health.noVaccineRecords}</p>` : `
          <table>
            <colgroup><col class="date"><col style="width: 24%"><col><col style="width: 26%"><col class="date"></colgroup>
            <thead><tr><th>Date</th><th>${isFrench ? 'Vaccin' : 'Vaccine'}</th><th>${isFrench ? 'Produit · lot' : 'Product · lot'}</th><th>${isFrench ? 'Clinique' : 'Clinic'}</th><th>${isFrench ? 'Rappel' : 'Booster'}</th></tr></thead>
            <tbody>${vaccineRows}</tbody>
          </table>`}
          ${earlierLine(sortedVaccines.length - shownVaccines.length)}
        </section>

        <div class="columns">
          <section id="dewormings">
            <h2>${t.health.deworming} (${isFrench ? '12 derniers mois' : 'last 12 months'})</h2>
            ${shownDewormings.length === 0 ? `<p>${t.health.noDewormingRecords}</p>` : `
            <table>
              <colgroup><col class="date"><col><col class="date"></colgroup>
              <thead><tr><th>Date</th><th>${isFrench ? 'Produit' : 'Product'}</th><th>${isFrench ? 'Prochaine' : 'Next'}</th></tr></thead>
              <tbody>${dewormingRows}</tbody>
            </table>`}
            ${earlierLine(sortedDewormings.length - shownDewormings.length)}
          </section>

          <section id="treatments">
            <h2>${t.health.medicationHistory} (${isFrench ? '90 derniers jours' : 'last 90 days'})</h2>
            ${shownMedications.length === 0 ? `<p>${t.health.noMedicationRecords}</p>` : `
            <table>
              <colgroup><col class="date"><col></colgroup>
              <thead><tr><th>Date</th><th>${isFrench ? 'Traitement' : 'Treatment'}</th></tr></thead>
              <tbody>${medicationRows}</tbody>
            </table>`}
            ${earlierLine(medications.length - shownMedications.length)}
          </section>
        </div>

        <section id="weight">
          <h2>${t.weightChart.title}</h2>
          ${entries.length === 0 ? `<p>${isFrench ? 'Aucune pesée enregistrée.' : 'No weigh-ins yet.'}</p>` : `
          <div class="weight">
            <div class="chart">
              ${weightChartSvg(geometry, adultLabel, t)}
              <p class="legend">${legend}</p>
            </div>
            <div class="list">
              <table>
                <colgroup><col class="date"><col></colgroup>
                <thead><tr><th>Date</th><th>${t.weightChart.title}</th></tr></thead>
                <tbody>${weighInRows}</tbody>
              </table>
              ${earlierLine(entries.length - shownWeighIns.length)}
            </div>
          </div>`}
        </section>
      </body>
    </html>
  `;

  writeAndPrint(windowPrint, html);
  return true;
}
