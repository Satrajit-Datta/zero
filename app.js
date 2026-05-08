// ─── js/app.js ─── Main application orchestrator ─────────────────────────────

const { Simulator: SIM, MLModels: ML, Charts, SpaceMap } = window;

let STATE = {
  bookings:    [],
  spaces:      [],
  heatmap:     [],
  selectedSpace: null,
  refreshTimer:  null,
  refreshCount:  0,
};

const DAYS_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  startClock();
  await bootSystem();
  setupNav();
  setupRefreshBtn();
  setupTemporalTabs();
  setupSpaceSelector();
  startAutoRefresh(30);
});

async function bootSystem() {
  // Small yield to let loader paint
  await new Promise(r => setTimeout(r, 400));

  STATE.bookings = SIM.generateBookings(1500);
  STATE.spaces   = SIM.getSpacesWithUtil();
  STATE.heatmap  = SIM.generateHeatmap();

  renderKPIs();
  initMap();
  renderUtilBars();
  renderNoShowTable();
  renderHeatmap();
  renderAnomalies();
  renderOptimization();
  renderTemporalPatterns('SPC001');
  renderFeatureImportance();

  // Load forecast for first space
  loadForecast(STATE.spaces[0]);

  hideLoader();
  showToast('✅ AI models loaded — dashboard live', 'success');
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function renderKPIs() {
  const s = SIM.getDashboardSummary(STATE.bookings);
  setText('kpi-total',      s.total_reservations.toLocaleString());
  setText('kpi-util',       s.avg_utilization_rate + '%');
  setText('kpi-noshow',     s.noshow_rate + '%');
  setText('kpi-alerts',     s.overcrowding_alerts);
  setText('kpi-informal',   s.informal_usage_count);
  setText('kpi-underutil',  s.spaces_underutilized + ' spaces');
  setText('kpi-cancel',     s.cancellation_rate + '%');
  setText('kpi-overcrowded',s.spaces_overcrowded + ' spaces');
}

// ─── Map ──────────────────────────────────────────────────────────────────────
function initMap() {
  SpaceMap.initMap('space-map');
  SpaceMap.updateMarkers(STATE.spaces);
  SpaceMap.fitBounds(STATE.spaces);
  SpaceMap.onSpaceClick(space => {
    STATE.selectedSpace = space;
    showToast(`📍 Loading forecast: ${space.name}`, 'info');
    loadForecast(space);
    // Update space selector
    const sel = document.getElementById('forecast-space-sel');
    if (sel) sel.value = space.id;
  });
}

// ─── Occupancy Forecast ───────────────────────────────────────────────────────
function loadForecast(space) {
  STATE.selectedSpace = space;
  setText('forecast-title', `Occupancy Forecast — ${space.name}`);
  const occTs   = SIM.generateOccupancyTS(space.id, 14);
  const series  = occTs.map(r => r.actual_occupancy);
  const forecast = ML.OccupancyForecaster.forecast(series, 24);
  Charts.renderOccupancyForecast('forecast-chart', forecast);

  // Temporal patterns for selected space
  renderTemporalPatterns(space.id);

  // Anomalies for selected space
  const anomalies = ML.InformalUsageDetector.detect(occTs);
  renderAnomaliesData(anomalies, space.name);
}

// ─── Utilization Bars ────────────────────────────────────────────────────────
function renderUtilBars() {
  Charts.renderUtilizationBars('util-chart', STATE.spaces);
}

// ─── No-Show Risk Table ───────────────────────────────────────────────────────
function renderNoShowTable() {
  const risks = ML.NoShowPredictor.getTopRisks(STATE.bookings, 20);
  const tbody = document.getElementById('noshow-tbody');
  if (!tbody) return;
  tbody.innerHTML = risks.map(r => `
    <tr>
      <td><code style="font-size:11px;color:#7b92b8">${r.booking_id}</code></td>
      <td><span class="type-badge">${r.space_type.replace(/_/g,' ')}</span></td>
      <td>${r.user_id}</td>
      <td>${String(r.start_hour).padStart(2,'0')}:00</td>
      <td>${DAY_SHORT[r.day_of_week]}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:50px;height:5px;background:#1e2d4a;border-radius:99px;overflow:hidden">
            <div style="width:${(r.risk_score*100).toFixed(0)}%;height:100%;background:${
              r.risk_score >= 0.6 ? '#ef4444' : r.risk_score >= 0.3 ? '#f59e0b' : '#10b981'
            };border-radius:99px"></div>
          </div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px">${(r.risk_score*100).toFixed(0)}%</span>
        </div>
      </td>
      <td><span class="risk-badge risk-${r.risk_level.toLowerCase()}">${r.risk_level}</span></td>
      <td style="font-size:11px;color:#7b92b8;max-width:180px">${r.reasons[0]}</td>
    </tr>`).join('');
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
function renderHeatmap() {
  const canvas = document.getElementById('heatmap-canvas');
  if (!canvas) return;
  canvas.width  = canvas.parentElement.clientWidth  || 800;
  canvas.height = 200;
  Charts.renderHeatmap('heatmap-canvas', STATE.heatmap);
}

// ─── Anomaly Panel ───────────────────────────────────────────────────────────
function renderAnomalies() {
  const sp  = STATE.spaces[0];
  const occ = SIM.generateOccupancyTS(sp.id, 7);
  const anomalies = ML.InformalUsageDetector.detect(occ);
  renderAnomaliesData(anomalies, sp.name);
}

function renderAnomaliesData(anomalies, spaceName) {
  const list = document.getElementById('anomaly-list');
  if (!list) return;
  if (!anomalies.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">✅</div><div>No anomalies detected</div></div>';
    return;
  }
  list.innerHTML = anomalies.slice(0, 10).map(a => {
    const dt  = new Date(a.timestamp);
    const pct = Math.min(100, Math.round(a.surplus * 200));
    return `
      <div class="anomaly-item fade-in">
        <div class="anomaly-dot"></div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:600">${DAYS_LONG[dt.getDay()]}, ${String(dt.getHours()).padStart(2,'0')}:00</span>
            <span class="anomaly-score">⚠ ${a.anomaly_score.toFixed(2)}σ</span>
          </div>
          <div class="anomaly-meta">${spaceName} · Surplus: +${(a.surplus*100).toFixed(0)}% over reserved</div>
          <div class="surplus-bar-wrap">
            <div class="surplus-bar">
              <div class="surplus-bar-fill" style="width:${pct}%"></div>
            </div>
            <span style="font-size:10px;color:#7b92b8">${pct}%</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Optimization Recommendations ────────────────────────────────────────────
function renderOptimization() {
  const recs = ML.DemandOptimizer.optimize(STATE.spaces);
  const list = document.getElementById('rec-list');
  if (!list) return;
  if (!recs.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><div>All spaces optimally balanced</div></div>';
    return;
  }
  list.innerHTML = recs.map(r => `
    <div class="rec-card fade-in">
      <div class="rec-header">
        <div class="rec-arrow">
          <span class="rec-from">↑ ${r.from_space.length > 16 ? r.from_space.slice(0,16)+'…' : r.from_space}</span>
          <span style="color:#4a6080">→</span>
          <span class="rec-to">↓ ${r.to_space.length > 16 ? r.to_space.slice(0,16)+'…' : r.to_space}</span>
        </div>
        <span class="rec-gain">+${r.expected_gain.toFixed(0)}% efficiency</span>
      </div>
      <div class="rec-rationale">${r.rationale}</div>
      <div class="rec-meta">
        <span class="rec-stat">From: <strong>${r.from_util}%</strong></span>
        <span class="rec-stat">To: <strong>${r.to_util}%</strong></span>
        <span class="rec-stat">Shift: <strong>${r.shift_units} units</strong></span>
        <span class="rec-stat">Type: <strong>${r.space_type.replace(/_/g,' ')}</strong></span>
      </div>
    </div>`).join('');
}

// ─── Temporal Patterns ────────────────────────────────────────────────────────
function renderTemporalPatterns(spaceId) {
  const occ      = SIM.generateOccupancyTS(spaceId, 30);
  const patterns = ML.TemporalPatternMiner.mine(occ);
  const wdVsWe   = ML.TemporalPatternMiner.weekdayVsWeekend(occ);

  // Radar chart
  Charts.renderTemporalRadar('temporal-radar', patterns);

  // Pattern cards
  const container = document.getElementById('pattern-cards');
  if (container) {
    container.innerHTML = patterns.map(p => `
      <div class="pattern-card fade-in">
        <div class="pattern-label">Cluster ${p.cluster}</div>
        <div class="pattern-name">${p.label}</div>
        <div class="progress-row">
          <span class="progress-label">Actual</span>
          <div class="progress-bar"><div class="progress-fill fill-actual" style="width:${(p.avg_actual*100).toFixed(0)}%"></div></div>
          <span class="progress-val">${(p.avg_actual*100).toFixed(0)}%</span>
        </div>
        <div class="progress-row">
          <span class="progress-label">Reserved</span>
          <div class="progress-bar"><div class="progress-fill fill-reserved" style="width:${(p.avg_reserved*100).toFixed(0)}%"></div></div>
          <span class="progress-val">${(p.avg_reserved*100).toFixed(0)}%</span>
        </div>
        <div style="font-size:11px;color:#7b92b8;margin-top:6px">Peak hour: ${String(p.peak_hour).padStart(2,'0')}:00 · ${p.count} records</div>
      </div>`).join('');
  }

  // Weekday vs weekend stats
  setText('wd-avg',  (wdVsWe.weekday_avg * 100).toFixed(1) + '%');
  setText('we-avg',  (wdVsWe.weekend_avg * 100).toFixed(1) + '%');
  setText('wd-peak', String(wdVsWe.weekday_peak).padStart(2,'0') + ':00');
  setText('we-peak', String(wdVsWe.weekend_peak).padStart(2,'0') + ':00');
}

// ─── Feature Importance ───────────────────────────────────────────────────────
function renderFeatureImportance() {
  Charts.renderFeatureImportance('importance-chart', ML.NoShowPredictor.featureImportance());
}

// ─── Temporal Tabs ────────────────────────────────────────────────────────────
function setupTemporalTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.querySelectorAll('.temporal-panels > div').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`tab-${target}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// ─── Space Selector ───────────────────────────────────────────────────────────
function setupSpaceSelector() {
  const sel = document.getElementById('forecast-space-sel');
  if (!sel) return;
  SIM.SPACES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    const space = STATE.spaces.find(s => s.id === sel.value) || SIM.SPACES.find(s => s.id === sel.value);
    if (space) loadForecast(space);
  });
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const section = document.getElementById(item.dataset.section);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ─── Refresh ──────────────────────────────────────────────────────────────────
function setupRefreshBtn() {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', () => doRefresh(btn));
}

async function doRefresh(btn) {
  btn?.classList.add('spinning');
  await new Promise(r => setTimeout(r, 600));

  STATE.bookings = SIM.generateBookings(1500);
  STATE.spaces   = SIM.getSpacesWithUtil();
  STATE.heatmap  = SIM.generateHeatmap();

  renderKPIs();
  SpaceMap.updateMarkers(STATE.spaces);
  renderUtilBars();
  renderNoShowTable();
  renderHeatmap();
  renderAnomalies();
  renderOptimization();
  if (STATE.selectedSpace) {
    loadForecast(STATE.selectedSpace);
  } else {
    loadForecast(STATE.spaces[0]);
  }

  STATE.refreshCount++;
  setText('refresh-count', STATE.refreshCount);
  btn?.classList.remove('spinning');
  showToast('🔄 Dashboard refreshed', 'info');
}

function startAutoRefresh(seconds) {
  STATE.refreshTimer = setInterval(() => {
    doRefresh(document.getElementById('refresh-btn'));
  }, seconds * 1000);
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const tick = () => {
    const n = new Date();
    el.textContent = n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

// ─── Loader ───────────────────────────────────────────────────────────────────
function hideLoader() {
  const ov = document.getElementById('loader');
  if (ov) {
    setTimeout(() => ov.classList.add('hidden'), 200);
    setTimeout(() => ov.remove(), 800);
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
