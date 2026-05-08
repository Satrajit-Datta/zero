// ─── js/map.js ─── Leaflet.js space map ──────────────────────────────────────

let _map = null;
let _markers = [];
let _onClickCb = null;

const STATUS_COLORS = {
  overcrowded:   { fill: '#ef4444', border: '#fca5a5' },
  normal:        { fill: '#10b981', border: '#6ee7b7' },
  underutilized: { fill: '#4f8ef7', border: '#93c5fd' },
};

function makeIcon(space) {
  const c = STATUS_COLORS[space.status] || STATUS_COLORS.normal;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${c.fill}" flood-opacity="0.5"/>
      </filter>
    </defs>
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z"
      fill="${c.fill}" filter="url(#shadow)"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
    <circle cx="14" cy="14" r="3" fill="${c.fill}"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize:   [28, 36],
    iconAnchor: [14, 36],
    popupAnchor:[0, -36],
  });
}

function popupHTML(space) {
  const pct   = (space.utilization * 100).toFixed(0);
  const sColor= STATUS_COLORS[space.status]?.fill || '#10b981';
  const typeLabel = space.type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  return `
    <div style="font-family:Inter,sans-serif;min-width:180px;padding:4px">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1e293b">${space.name}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">${typeLabel}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:12px;color:#475569">Utilization</span>
        <span style="font-weight:700;font-size:13px;color:${sColor}">${pct}%</span>
      </div>
      <div style="background:#e2e8f0;border-radius:99px;height:6px;margin-bottom:8px">
        <div style="background:${sColor};width:${pct}%;height:100%;border-radius:99px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b">
        <span>Capacity: ${space.capacity}</span>
        <span style="color:${sColor};font-weight:600;text-transform:capitalize">${space.status}</span>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
        Click to load forecast →
      </div>
    </div>`;
}

function initMap(containerId) {
  if (_map) { _map.remove(); _map = null; }

  _map = L.map(containerId, {
    center: [51.507, -0.128], zoom: 14,
    zoomControl: true, attributionControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(_map);

  return _map;
}

function updateMarkers(spaces) {
  if (!_map) return;
  _markers.forEach(m => m.remove());
  _markers = [];

  spaces.forEach(space => {
    const marker = L.marker([space.lat, space.lng], { icon: makeIcon(space) })
      .bindPopup(popupHTML(space), { maxWidth: 240, className: 'uris-popup' })
      .addTo(_map);

    marker.on('click', () => {
      if (_onClickCb) _onClickCb(space);
    });

    _markers.push(marker);
  });
}

function onSpaceClick(cb) { _onClickCb = cb; }

function fitBounds(spaces) {
  if (!_map || !spaces.length) return;
  const bounds = L.latLngBounds(spaces.map(s => [s.lat, s.lng]));
  _map.fitBounds(bounds, { padding: [30, 30] });
}

window.SpaceMap = { initMap, updateMarkers, onSpaceClick, fitBounds };
