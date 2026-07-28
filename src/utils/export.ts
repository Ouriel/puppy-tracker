import type { Activity, PuppyProfile } from '../types';

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
  link.setAttribute('download', `${profile.name}_activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
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
