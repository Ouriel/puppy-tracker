import type { Activity, PuppyProfile } from '../types';
import { formatLocalDate } from './date';

export function exportActivitiesToCSV(activities: Activity[], profile: PuppyProfile) {
  const headers = ['Timestamp', 'Type', 'Logged By', 'Location / Consistency', 'Quantity / Duration', 'Notes'];
  
  const rows = activities.map((activity) => {
    let details = '';
    if (activity.pottyLocation) details += `Location: ${activity.pottyLocation}; `;
    if (activity.stoolConsistency) details += `Stool: ${activity.stoolConsistency}; `;
    if (activity.foodType) details += `Food: ${activity.foodType}; `;

    let qty = '';
    if (activity.quantityGrams) qty += `${activity.quantityGrams}g `;
    if (activity.quantityCups) qty += `(${activity.quantityCups} cups) `;
    if (activity.durationMinutes) qty += `${activity.durationMinutes} mins `;
    if (activity.weightKg) qty += `${activity.weightKg} kg `;

    return [
      new Date(activity.timestamp).toLocaleString(),
      activity.type.toUpperCase(),
      `"${activity.loggedBy}"`,
      `"${details.trim()}"`,
      `"${qty.trim()}"`,
      `"${(activity.notes || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${profile.name}_activity_log_${formatLocalDate()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printVetReport(activities: Activity[], profile: PuppyProfile) {
  const windowPrint = window.open('', '', 'width=800,height=900');
  if (!windowPrint) return;

  const today = new Date().toLocaleDateString();
  const sorted = [...activities].sort((activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime());

  const totalMeals = activities.filter((activity) => activity.type === 'food').length;
  const totalAccidents = activities.filter((activity) => activity.pottyLocation === 'indoor_accident').length;
  const totalOutside = activities.filter((activity) => activity.pottyLocation === 'outside').length;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${profile.name} - Vet Activity Report</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; }
          h1 { color: #0f172a; margin-bottom: 4px; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
          .meta { display: flex; gap: 24px; font-size: 14px; color: #475569; }
          .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .stat { text-align: center; }
          .stat-val { font-size: 20px; font-weight: bold; color: #4f46e5; }
          .stat-label { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; }
          tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🐾 ${profile.name} - Veterinary & Health Summary</h1>
          <div class="meta">
            <div><strong>Breed:</strong> ${profile.breed}</div>
            <div><strong>Daily Food Goal:</strong> ${profile.dailyFoodGramGoal}g / day (${profile.targetMealsPerDay || 3} meals)</div>
            <div><strong>Generated:</strong> ${today}</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="stat"><div class="stat-val">${sorted.length}</div><div class="stat-label">Total Logs</div></div>
          <div class="stat"><div class="stat-val">${totalOutside}</div><div class="stat-label">Outside Potty</div></div>
          <div class="stat"><div class="stat-val">${totalAccidents}</div><div class="stat-label">Accidents</div></div>
          <div class="stat"><div class="stat-val">${totalMeals}</div><div class="stat-label">Meals Logged</div></div>
        </div>

        <h2>Activity Timeline</h2>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Activity</th>
              <th>Details</th>
              <th>Logged By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((activity) => `
              <tr>
                <td>${new Date(activity.timestamp).toLocaleString()}</td>
                <td><strong>${activity.type.toUpperCase()}</strong></td>
                <td>
                  ${activity.pottyLocation ? `Location: ${activity.pottyLocation}<br/>` : ''}
                  ${activity.stoolConsistency ? `Consistency: ${activity.stoolConsistency}<br/>` : ''}
                  ${activity.quantityGrams ? `Amount: ${activity.quantityGrams}g` : ''}
                  ${activity.durationMinutes ? `Duration: ${activity.durationMinutes}m` : ''}
                </td>
                <td>${activity.loggedBy}</td>
                <td>${activity.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  windowPrint.document.write(html);
  windowPrint.document.close();
}

export function printHealthPassportReport(
  profile: PuppyProfile,
  vaccinations: import('../types').HealthRecord[],
  dewormings: import('../types').HealthRecord[],
  activities: Activity[] = [],
  _lang = 'fr',
  _t?: any
) {
  const windowPrint = window.open('', '', 'width=900,height=1000');
  if (!windowPrint) return;

  const today = new Date().toLocaleDateString();
  const sortedVaccines = [...vaccinations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const sortedDewormings = [...dewormings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const weightLogs = activities
    .filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestWeight = weightLogs.length > 0 ? weightLogs[0].weightKg : (profile.weightKg || '-');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${profile.name} - Carnet de Santé Vétérinaire</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #0f172a; line-height: 1.4; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title-area h1 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
          .title-area p { margin: 0; font-size: 13px; color: #64748b; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: #e0f2fe; color: #0369a1; }
          .grid-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
          .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .card-value { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px; }
          h2 { font-size: 15px; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 20px 0 10px 0; display: flex; align-items: center; gap: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          .status-tag { font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
          .status-ok { background: #dcfce7; color: #166534; }
          .status-warn { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>🐾 Carnet de Santé & Passeport Vaccinal — ${profile.name}</h1>
            <p>Dossier Médical Vétérinaire &bull; ${profile.breed} &bull; Édité le ${today}</p>
          </div>
          <span class="badge">PupPace Health Passport</span>
        </div>

        <div class="grid-summary">
          <div class="card">
            <div class="card-label">Nom du Chien</div>
            <div class="card-value">${profile.name}</div>
          </div>
          <div class="card">
            <div class="card-label">Race</div>
            <div class="card-value">${profile.breed}</div>
          </div>
          <div class="card">
            <div class="card-label">Date de Naissance</div>
            <div class="card-value">${profile.birthDate || '-'}</div>
          </div>
          <div class="card">
            <div class="card-label">Dernier Poids Connu</div>
            <div class="card-value">${latestWeight} kg</div>
          </div>
        </div>

        <h2>💉 Historique des Vaccinations & Rappels WSAVA</h2>
        ${sortedVaccines.length === 0 ? '<p style="font-size:12px;color:#64748b;">Aucun vaccin enregistré.</p>' : `
        <table>
          <thead>
            <tr>
              <th>Date Injection</th>
              <th>Protocole Vaccinal</th>
              <th>Prochain Rappel</th>
              <th>Clinique Vétérinaire</th>
              <th>N° Lot / Flacon</th>
            </tr>
          </thead>
          <tbody>
            ${sortedVaccines.map((v) => `
              <tr>
                <td><strong>${v.date}</strong></td>
                <td>${v.name}</td>
                <td>${v.boosterDate || '-'}</td>
                <td>${v.vetClinic || 'Clinique Vétérinaire'}</td>
                <td>${v.batchNumber || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}

        <h2>💊 Historique Vermifuge & Parasitologie (Protocole ESCCAP)</h2>
        ${sortedDewormings.length === 0 ? '<p style="font-size:12px;color:#64748b;">Aucun traitement vermifuge enregistré.</p>' : `
        <table>
          <thead>
            <tr>
              <th>Date Administration</th>
              <th>Produit Antiparasitaire</th>
              <th>Poids au Traitement</th>
              <th>Prochain Traitement Dû</th>
            </tr>
          </thead>
          <tbody>
            ${sortedDewormings.map((d) => `
              <tr>
                <td><strong>${d.date}</strong></td>
                <td>${d.productName || d.name}</td>
                <td>${d.weightAtTime ? `${d.weightAtTime} kg` : '-'}</td>
                <td>${d.boosterDate || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}

        <h2>⚖️ Historique des Pesées & Croissance</h2>
        ${weightLogs.length === 0 ? '<p style="font-size:12px;color:#64748b;">Aucune pesée enregistrée.</p>' : `
        <table>
          <thead>
            <tr>
              <th>Date & Heure</th>
              <th>Poids (kg)</th>
              <th>Enregistré Par</th>
              <th>Notes / Remarques</th>
            </tr>
          </thead>
          <tbody>
            ${weightLogs.slice(0, 10).map((w) => `
              <tr>
                <td>${new Date(w.timestamp).toLocaleDateString()}</td>
                <td><strong>${w.weightKg} kg</strong></td>
                <td>${w.loggedBy}</td>
                <td>${w.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}

        <div class="footer">
          Document généré via PupPace — Application de Suivi & Carnet de Santé Familial du Chiot.
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  windowPrint.document.write(html);
  windowPrint.document.close();
}

