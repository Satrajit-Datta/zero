// ─── js/charts.js ─── Chart.js visualizations ────────────────────────────────

const CHART_DEFAULTS = {
  font:      'Inter',
  gridColor: 'rgba(30,45,74,0.6)',
  textColor: '#7b92b8',
  accent:    '#4f8ef7',
  accent2:   '#22d3ee',
  accent3:   '#a78bfa',
  success:   '#10b981',
  warning:   '#f59e0b',
  danger:    '#ef4444',
};

Chart.defaults.font.family = CHART_DEFAULTS.font;
Chart.defaults.color       = CHART_DEFAULTS.textColor;

const _instances = {};

function _destroy(id) {
  if (_instances[id]) { _instances[id].destroy(); delete _instances[id]; }
}

// ─── Occupancy Forecast ───────────────────────────────────────────────────────
function renderOccupancyForecast(canvasId, forecastData) {
  _destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels  = forecastData.map(d => `${String(d.hour).padStart(2,'0')}:00`);
  const pred    = forecastData.map(d => +(d.predicted * 100).toFixed(1));
  const upper   = forecastData.map(d => +(d.upper     * 100).toFixed(1));
  const lower   = forecastData.map(d => +(d.lower     * 100).toFixed(1));

  _instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Predicted Occupancy %',
          data: pred,
          borderColor: CHART_DEFAULTS.accent,
          backgroundColor: 'rgba(79,142,247,0.08)',
          borderWidth: 2.5, pointRadius: 3,
          pointBackgroundColor: CHART_DEFAULTS.accent,
          fill: false, tension: 0.4,
        },
        {
          label: 'Upper CI',
          data: upper,
          borderColor: 'rgba(79,142,247,0.25)',
          borderWidth: 1, borderDash: [4,4],
          pointRadius: 0, fill: '+1',
          backgroundColor: 'rgba(79,142,247,0.06)',
        },
        {
          label: 'Lower CI',
          data: lower,
          borderColor: 'rgba(79,142,247,0.25)',
          borderWidth: 1, borderDash: [4,4],
          pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(30,45,74,0.8)', borderWidth: 1,
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` },
        },
      },
      scales: {
        x: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { maxTicksLimit: 12 } },
        y: { grid: { color: CHART_DEFAULTS.gridColor },
          ticks: { callback: v => v + '%' }, min: 0, max: 100 },
      },
    },
  });
}

// ─── Utilization Bar Chart ────────────────────────────────────────────────────
function renderUtilizationBars(canvasId, spaces) {
  _destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const sorted = [...spaces].sort((a,b) => b.utilization - a.utilization).slice(0,10);

  _instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s.name.length > 14 ? s.name.slice(0,14)+'…' : s.name),
      datasets: [{
        label: 'Utilization %',
        data: sorted.map(s => +(s.utilization * 100).toFixed(1)),
        backgroundColor: sorted.map(s =>
          s.utilization > 0.80 ? 'rgba(239,68,68,0.7)' :
          s.utilization < 0.40 ? 'rgba(79,142,247,0.5)' : 'rgba(16,185,129,0.6)'),
        borderColor: sorted.map(s =>
          s.utilization > 0.80 ? '#ef4444' :
          s.utilization < 0.40 ? '#4f8ef7' : '#10b981'),
        borderWidth: 1, borderRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `Utilization: ${ctx.parsed.x}%` } },
      },
      scales: {
        x: { grid: { color: CHART_DEFAULTS.gridColor },
          ticks: { callback: v => v + '%' }, max: 100 },
        y: { grid: { display: false } },
      },
    },
  });
}

// ─── Feature Importance ───────────────────────────────────────────────────────
function renderFeatureImportance(canvasId, features) {
  _destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const sorted = [...features].sort((a,b) => a.importance - b.importance);

  _instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(f => f.feature),
      datasets: [{
        label: 'Importance',
        data: sorted.map(f => f.importance),
        backgroundColor: 'rgba(167,139,250,0.5)',
        borderColor: '#a78bfa',
        borderWidth: 1, borderRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_DEFAULTS.gridColor }, max: 0.35,
          ticks: { callback: v => (v*100).toFixed(0)+'%' } },
        y: { grid: { display: false } },
      },
    },
  });
}

// ─── Temporal Radar ───────────────────────────────────────────────────────────
function renderTemporalRadar(canvasId, patterns) {
  _destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');

  _instances[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: patterns.map(p => p.label),
      datasets: [
        {
          label: 'Actual Occupancy',
          data: patterns.map(p => +(p.avg_actual * 100).toFixed(1)),
          borderColor: CHART_DEFAULTS.accent,
          backgroundColor: 'rgba(79,142,247,0.12)',
          pointBackgroundColor: CHART_DEFAULTS.accent,
        },
        {
          label: 'Reserved Occupancy',
          data: patterns.map(p => +(p.avg_reserved * 100).toFixed(1)),
          borderColor: CHART_DEFAULTS.accent3,
          backgroundColor: 'rgba(167,139,250,0.10)',
          pointBackgroundColor: CHART_DEFAULTS.accent3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: CHART_DEFAULTS.textColor, boxWidth: 10 } },
      },
      scales: {
        r: {
          grid: { color: CHART_DEFAULTS.gridColor },
          angleLines: { color: CHART_DEFAULTS.gridColor },
          pointLabels: { color: CHART_DEFAULTS.textColor, font: { size: 11 } },
          ticks: { display: false }, min: 0, max: 100,
        },
      },
    },
  });
}

// ─── Demand Heatmap (Custom Canvas) ──────────────────────────────────────────
function renderHeatmap(canvasId, heatmapData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const cellW = (canvas.width  - 48) / 24;
  const cellH = (canvas.height - 32) / 7;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw cells
  for (const d of heatmapData) {
    const x = 48 + d.hour * cellW;
    const y = 16 + d.day  * cellH;
    const t = d.intensity;
    // Color gradient: dark blue → cyan → orange → red
    let r, g, b;
    if (t < 0.33)      { r=7;   g=Math.round(t/0.33*130); b=Math.round(80+t/0.33*100); }
    else if (t < 0.66) { r=Math.round((t-0.33)/0.33*245); g=Math.round(130+(t-0.33)/0.33*81); b=50; }
    else               { r=245+Math.round((t-0.66)/0.34*10); g=Math.round(211-(t-0.66)/0.34*200); b=10; }
    ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
    ctx.beginPath();
    ctx.roundRect(x+1, y+1, cellW-2, cellH-2, 3);
    ctx.fill();
  }

  // Day labels
  ctx.fillStyle = '#7b92b8'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
  DAYS.forEach((d, i) => ctx.fillText(d, 44, 16 + i * cellH + cellH/2 + 4));

  // Hour labels
  ctx.textAlign = 'center';
  [0,3,6,9,12,15,18,21].forEach(h => {
    ctx.fillText(`${String(h).padStart(2,'0')}:00`, 48 + h * cellW + cellW/2, canvas.height - 2);
  });
}

window.Charts = {
  renderOccupancyForecast,
  renderUtilizationBars,
  renderFeatureImportance,
  renderTemporalRadar,
  renderHeatmap,
};
