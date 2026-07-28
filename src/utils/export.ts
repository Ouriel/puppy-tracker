import type { Activity, PuppyProfile } from '../types';

export function exportActivitiesToCSV(activities: Activity[], profile: PuppyProfile) {
  const headers = ['Timestamp', 'Type', 'Logged By', 'Location / Consistency', 'Quantity / Duration', 'Notes'];
  
  const rows = activities.map((a) => {
    let details = '';
    if (a.pottyLocation) details += `Location: ${a.pottyLocation}; `;
    if (a.stoolConsistency) details += `Stool: ${a.stoolConsistency}; `;
    if (a.foodType) details += `Food: ${a.foodType}; `;

    let qty = '';
    if (a.quantityGrams) qty += `${a.quantityGrams}g `;
    if (a.quantityCups) qty += `(${a.quantityCups} cups) `;
    if (a.durationMinutes) qty += `${a.durationMinutes} mins `;
    if (a.weightKg) qty += `${a.weightKg} kg `;

    return [
      new Date(a.timestamp).toLocaleString(),
      a.type.toUpperCase(),
      `"${a.loggedBy}"`,
      `"${details.trim()}"`,
      `"${qty.trim()}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${profile.name}_activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printVetReport(activities: Activity[], profile: PuppyProfile) {
  const windowPrint = window.open('', '', 'width=800,height=900');
  if (!windowPrint) return;

  const today = new Date().toLocaleDateString();
  const sorted = [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalMeals = activities.filter(a => a.type === 'food').length;
  const totalAccidents = activities.filter(a => a.pottyLocation === 'indoor_accident').length;
  const totalOutside = activities.filter(a => a.pottyLocation === 'outside').length;

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
            ${sorted.map(a => `
              <tr>
                <td>${new Date(a.timestamp).toLocaleString()}</td>
                <td><strong>${a.type.toUpperCase()}</strong></td>
                <td>
                  ${a.pottyLocation ? `Location: ${a.pottyLocation}<br/>` : ''}
                  ${a.stoolConsistency ? `Consistency: ${a.stoolConsistency}<br/>` : ''}
                  ${a.quantityGrams ? `Amount: ${a.quantityGrams}g` : ''}
                  ${a.durationMinutes ? `Duration: ${a.durationMinutes}m` : ''}
                </td>
                <td>${a.loggedBy}</td>
                <td>${a.notes || '-'}</td>
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
