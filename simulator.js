// ─── js/simulator.js ─── Synthetic data engine (runs in browser) ───────────

const RNG = (() => {
  let seed = 42;
  return () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
})();
const rnd  = (min, max) => RNG() * (max - min) + min;
const rndI = (min, max) => Math.floor(rnd(min, max + 1));
const pick = arr => arr[Math.floor(RNG() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const randN = (mu = 0, sigma = 1) => { const u = 1 - RNG(), v = RNG(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*sigma+mu; };

const SPACE_COLORS = {
  parking:              '#4f8ef7',
  sports_venue:         '#22d3ee',
  coworking:            '#a78bfa',
  study_zone:           '#10b981',
  community_hall:       '#f59e0b',
  shared_infrastructure:'#ef4444',
};

const SPACES = [
  {id:'SPC001',name:'Central Parking A',    type:'parking',               capacity:200, lat:51.5074,lng:-0.1278},
  {id:'SPC002',name:'North Parking B',      type:'parking',               capacity:150, lat:51.5130,lng:-0.1200},
  {id:'SPC003',name:'East Parking C',       type:'parking',               capacity:180, lat:51.5020,lng:-0.1150},
  {id:'SPC004',name:'Arena Stadium',         type:'sports_venue',          capacity:500, lat:51.5089,lng:-0.1300},
  {id:'SPC005',name:'Community Sports Hall',type:'sports_venue',          capacity:100, lat:51.5050,lng:-0.1350},
  {id:'SPC006',name:'Tennis Courts',         type:'sports_venue',          capacity: 50, lat:51.5110,lng:-0.1250},
  {id:'SPC007',name:'Innovation Hub',        type:'coworking',             capacity: 80, lat:51.5060,lng:-0.1280},
  {id:'SPC008',name:'Digital Lounge',        type:'coworking',             capacity: 60, lat:51.5080,lng:-0.1320},
  {id:'SPC009',name:'Startup Dock',          type:'coworking',             capacity: 90, lat:51.5040,lng:-0.1260},
  {id:'SPC010',name:'Library Zone A',        type:'study_zone',            capacity:120, lat:51.5095,lng:-0.1290},
  {id:'SPC011',name:'Library Zone B',        type:'study_zone',            capacity: 80, lat:51.5070,lng:-0.1310},
  {id:'SPC012',name:'Reading Corner',        type:'study_zone',            capacity: 40, lat:51.5055,lng:-0.1270},
  {id:'SPC013',name:'Town Hall',             type:'community_hall',        capacity:300, lat:51.5085,lng:-0.1295},
  {id:'SPC014',name:'Community Center',      type:'community_hall',        capacity:150, lat:51.5100,lng:-0.1240},
  {id:'SPC015',name:'Civic Square',          type:'community_hall',        capacity:200, lat:51.5065,lng:-0.1330},
  {id:'SPC016',name:'Power Grid Station',    type:'shared_infrastructure', capacity: 10, lat:51.5015,lng:-0.1200},
  {id:'SPC017',name:'Water Access Point',    type:'shared_infrastructure', capacity:  5, lat:51.5125,lng:-0.1350},
  {id:'SPC018',name:'EV Charging Hub',       type:'shared_infrastructure', capacity: 20, lat:51.5035,lng:-0.1290},
  {id:'SPC019',name:'Bike Sharing Dock',     type:'shared_infrastructure', capacity: 30, lat:51.5090,lng:-0.1265},
  {id:'SPC020',name:'Public WiFi Node',      type:'shared_infrastructure', capacity:100, lat:51.5075,lng:-0.1305},
];

const TYPE_BASE_NOSHOW = {
  parking:0.22, sports_venue:0.18, coworking:0.14,
  study_zone:0.12, community_hall:0.16, shared_infrastructure:0.10,
};

function noshowProb(lead, cancelHist, dow, hour, freq, stype) {
  let b = TYPE_BASE_NOSHOW[stype] || 0.15;
  b += Math.min(lead * 0.018, 0.18);
  b += cancelHist * 0.045;
  if (dow >= 5) b -= 0.04;
  if (hour >= 9 && hour <= 17) b -= 0.03;
  if (freq > 10) b -= 0.05;
  return clamp(b, 0.05, 0.85);
}

function generateBookings(n = 1500) {
  const statuses = ['confirmed','cancelled','no_show','completed'];
  const now = Date.now();
  return Array.from({length: n}, (_, i) => {
    const sp  = pick(SPACES);
    const dt  = new Date(now - rndI(0, 90) * 86400000);
    const lead = rndI(0, 14);
    const hour = rndI(6, 21);
    const uid  = `USR${String(rndI(1,500)).padStart(4,'0')}`;
    const ch   = rndI(0, 5);
    const freq = rndI(1, 20);
    const nsp  = noshowProb(lead, ch, dt.getDay(), hour, freq, sp.type);
    const pCancel = 0.20, pNoShow = nsp * 0.45;
    const pComp = Math.max(0.01, 1 - 0.30 - pCancel - pNoShow);
    const r = RNG();
    let status;
    if (r < 0.30) status = 'confirmed';
    else if (r < 0.50) status = 'cancelled';
    else if (r < 0.50 + pNoShow) status = 'no_show';
    else status = 'completed';
    return {
      booking_id: `BK${String(i).padStart(5,'0')}`, space_id: sp.id,
      space_type: sp.type, space_name: sp.name, user_id: uid,
      booking_date: dt.toISOString(), lead_time_days: lead,
      start_hour: hour, duration_hours: rndI(1,4),
      day_of_week: dt.getDay(), is_weekend: dt.getDay()>=6?1:0,
      cancellation_history: ch, booking_frequency: freq,
      status, noshow_probability: +nsp.toFixed(3),
    };
  });
}

function baseOccupancy(h, dow, stype) {
  let base;
  if (h >= 6 && h <= 9) base = 0.70;
  else if (h >= 10 && h <= 16) base = 0.60;
  else if (h >= 17 && h <= 20) base = 0.80;
  else if (h >= 21 && h <= 23) base = 0.20;
  else base = 0.05;
  if (dow >= 6) {
    if (stype === 'sports_venue' || stype === 'community_hall') base *= 1.30;
    else base *= 0.70;
  }
  return base;
}

function generateOccupancyTS(spaceId, days = 14) {
  const sp  = SPACES.find(s => s.id === spaceId);
  const now = Date.now();
  const rows = [];
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 24; h++) {
      const dt   = new Date(now - (days - d) * 86400000);
      dt.setHours(h, 0, 0, 0);
      const base = baseOccupancy(h, dt.getDay(), sp.type);
      const actual   = clamp(base + randN(0, 0.08), 0, 1);
      const reserved = clamp(actual - 0.10 + randN(0, 0.05), 0, 1);
      rows.push({ space_id: spaceId, timestamp: dt.toISOString(),
        date: dt.toISOString().slice(0,10), hour: h, day_of_week: dt.getDay(),
        actual_occupancy: +actual.toFixed(3), reserved_occupancy: +reserved.toFixed(3),
        capacity: sp.capacity, actual_count: Math.round(actual*sp.capacity),
        reserved_count: Math.round(reserved*sp.capacity) });
    }
  }
  return rows;
}

function generateHeatmap() {
  const rows = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      let base;
      if (h >= 6 && h <= 9) base = 0.68;
      else if (h >= 10 && h <= 16) base = 0.60;
      else if (h >= 17 && h <= 20) base = 0.78;
      else if (h >= 21 && h <= 23) base = 0.25;
      else base = 0.06;
      if (dow >= 5) base = (h >= 10 && h <= 20) ? base * 1.15 : base * 0.55;
      rows.push({ day: dow, hour: h, intensity: +clamp(base + randN(0, 0.04), 0, 1).toFixed(3) });
    }
  }
  return rows;
}

function generateAccessLogs(n = 500) {
  const now = Date.now();
  return Array.from({length: n}, (_, i) => {
    const sp = pick(SPACES);
    const ts = new Date(now - rndI(0,30)*86400000 - rndI(0,86400000));
    const hasBooking = RNG() > 0.15;
    return {
      log_id: `LOG${String(i).padStart(5,'0')}`, space_id: sp.id,
      space_name: sp.name, timestamp: ts.toISOString(),
      event_type: RNG() > 0.5 ? 'entry' : 'exit',
      has_booking: hasBooking, is_informal: !hasBooking,
    };
  });
}

function getSpacesWithUtil() {
  return SPACES.map(s => {
    const util = +clamp(rnd(0.18, 0.97), 0, 1).toFixed(2);
    const status = util > 0.80 ? 'overcrowded' : util < 0.35 ? 'underutilized' : 'normal';
    return { ...s, utilization: util, status, color: SPACE_COLORS[s.type] };
  });
}

function getDashboardSummary(bookings) {
  const total     = bookings.length;
  const noshow    = bookings.filter(b => b.status === 'no_show').length;
  const cancelled = bookings.filter(b => b.status === 'cancelled').length;
  const informal  = Math.round(total * 0.14);
  return {
    total_reservations:   total,
    noshow_rate:          +((noshow / total) * 100).toFixed(1),
    cancellation_rate:    +((cancelled / total) * 100).toFixed(1),
    avg_utilization_rate: 67.3,
    informal_usage_count: informal,
    overcrowding_alerts:  rndI(3, 8),
    spaces_underutilized: rndI(5, 10),
    spaces_overcrowded:   rndI(2, 5),
  };
}

window.Simulator = {
  SPACES, SPACE_COLORS,
  generateBookings, generateOccupancyTS,
  generateHeatmap, generateAccessLogs,
  getSpacesWithUtil, getDashboardSummary,
};
