# 🏙 URIS — Urban Reservation Intelligence System

> An AI-powered dashboard that predicts occupancy, identifies no-show risk, detects informal usage anomalies, and optimises space allocation across urban public facilities.

**Live Demo (GitHub Pages):** `https://<your-username>.github.io/uris/`

---

## Problem Statement Breakdown & Git Workflow

Each section below maps directly to a point in the problem statement with the code that addresses it and the Git command to commit it.

---

### 📌 Point 1 — Reserved spaces remain unused; unreserved demand creates overcrowding

**Code:** `js/simulator.js` → `getSpacesWithUtil()`, `generateBookings()`
Generates 1,500 synthetic booking records with realistic no-show and cancellation distributions. Each space gets a live utilisation rate; status flags (`overcrowded`, `underutilized`, `normal`) drive the map markers and KPI alerts.

```bash
# ── Stage 1: Initialise repo and add data simulation ──
git init
git add js/simulator.js
git commit -m "feat: synthetic data engine — bookings, occupancy, access logs"
git branch -M main
git remote add origin https://github.com/<your-username>/uris.git
git push -u origin main
```

---

### 📌 Point 2 — Utilisation patterns vary across locations and time periods

**Code:** `js/charts.js` → `renderUtilizationBars()` + `renderHeatmap()`
A horizontal bar chart ranks all 20 spaces by utilisation. A custom canvas heatmap (7 days × 24 hours) shows demand intensity, revealing when and where overcrowding concentrates.

```bash
# ── Stage 2: Add spatial and temporal visualisations ──
git add js/charts.js style.css
git commit -m "feat: utilisation bar chart + demand heatmap canvas"
git push
```

---

### 📌 Point 3 — Temporal variation: cancellations, no-shows, informal occupancy

**Code:** `js/ml_models.js` → `NoShowPredictor`, `InformalUsageDetector`
- **NoShowPredictor** uses a weighted GBM-style scoring function with 6 features (lead time, cancellation history, frequency, day, hour, space type) to score every confirmed booking.
- **InformalUsageDetector** runs a z-score anomaly test on the `actual − reserved` surplus per time slot to surface unbooked occupancy spikes.

```bash
# ── Stage 3: Add ML no-show predictor + anomaly detector ──
git add js/ml_models.js
git commit -m "feat: GBM no-show predictor + z-score informal usage detector"
git push
```

---

### 📌 Point 4 — Multiple overlapping influences (habits, friction, scheduling, accessibility)

**Code:** `js/ml_models.js` → `NoShowPredictor.featureImportance()` + `TemporalPatternMiner`
The Feature Importance tab surfaces which signals drive no-show risk most strongly. The Temporal Pattern Miner applies k-means-style cluster assignment to group time slots into four behavioural archetypes (Morning Rush, Midday Steady, Evening Peak, Off-Peak Night).

```bash
# ── Stage 4: Add temporal miner + feature importance panel ──
git add js/ml_models.js js/charts.js
git commit -m "feat: KMeans temporal miner + feature importance visualisation"
git push
```

---

### 📌 Point 5 — Multi-source datasets (bookings, sensors, access logs, mobility)

**Code:** `js/simulator.js` — generates four independent dataset streams:
| Dataset | Generator Function | Records |
|---|---|---|
| Booking records | `generateBookings(1500)` | 1,500 |
| Occupancy time-series | `generateOccupancyTS(spaceId, days)` | 14d × 24h per space |
| Access logs | `generateAccessLogs(500)` | 500 |
| Demand heatmap | `generateHeatmap()` | 7 × 24 = 168 cells |

```bash
# ── Stage 5: Confirm all dataset streams are wired ──
git add js/simulator.js
git commit -m "feat: multi-source synthetic datasets — bookings, sensors, access logs, heatmap"
git push
```

---

### 📌 Point 6 — AI system: predict occupancy, no-show, informal usage, optimise allocation

**Code:** Full frontend + `js/app.js` orchestrator
| Requirement | Implementation |
|---|---|
| Predict occupancy trends | `OccupancyForecaster` — trend + 24-h seasonal decomposition |
| Identify no-show probability | `NoShowPredictor` — GBM weighted scoring |
| Model informal utilisation | `InformalUsageDetector` — z-score anomaly detection |
| Optimise allocation | `DemandOptimizer` — greedy same-type reallocation |
| Interpretable insights | Reasons array, feature importance, cluster labels |

```bash
# ── Stage 6: Wire full dashboard + app orchestrator ──
git add index.html js/app.js js/map.js js/charts.js
git commit -m "feat: full URIS dashboard — all AI panels wired and auto-refreshing"
git push
```

---

### 📌 Final Step — Deploy to GitHub Pages (Live Website)

```bash
# ── Deploy: Add workflow + root config files ──
git add .github/workflows/deploy.yml .gitignore README.md
git commit -m "ci: GitHub Pages auto-deploy workflow"
git push
```

Then in your GitHub repo:
1. Go to **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Wait ~60 seconds → your site is live at `https://<your-username>.github.io/uris/`

---

## 🖥 Running Locally (No install needed)

The website is 100% static — just open `index.html` in any browser:

```bash
# Option A: Double-click index.html in File Explorer

# Option B: Python simple server (recommended — avoids CORS issues)
cd C:\Users\satra\.gemini\antigravity\scratch\uris
python -m http.server 3000
# Then open: http://localhost:3000
```

---

## 🐍 Running the Python Backend (Full ML)

```bash
cd backend
pip install -r requirements.txt
python main.py
# API docs: http://localhost:8000/docs
```

**API Endpoints:**
| Endpoint | Description |
|---|---|
| `GET /api/dashboard/summary` | KPI summary |
| `GET /api/spaces` | All spaces with live utilisation |
| `GET /api/occupancy/forecast/{space_id}` | 24-hour forecast |
| `GET /api/noshow/risk` | Top 20 no-show risk bookings |
| `GET /api/anomalies` | Informal usage anomalies |
| `GET /api/heatmap` | Day × hour demand matrix |
| `GET /api/optimization/suggestions` | Reallocation recommendations |
| `GET /api/temporal/patterns` | Cluster analysis |

---

## 📁 Project Structure

```
uris/
├── index.html                  # Dashboard (GitHub Pages entry point)
├── style.css                   # Design system (dark theme)
├── js/
│   ├── simulator.js            # Synthetic data generator
│   ├── ml_models.js            # ML simulations (no-show, forecast, anomaly, optimizer)
│   ├── charts.js               # Chart.js + canvas visualisations
│   ├── map.js                  # Leaflet.js space map
│   └── app.js                  # Main orchestrator + auto-refresh
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── data_simulator.py       # Python data generator
│   ├── ml_engine.py            # sklearn ML models
│   ├── api_routes.py           # REST API routes
│   └── requirements.txt
├── .github/
│   └── workflows/deploy.yml    # Auto-deploy to GitHub Pages
└── README.md
```

---

## 🧠 ML Models Summary

| Model | Algorithm | Purpose |
|---|---|---|
| No-Show Predictor | Gradient Boosting (GBM) | Score each booking 0–100% risk |
| Occupancy Forecaster | Trend + Seasonal Decomposition | 24-h ahead occupancy prediction |
| Informal Usage Detector | Z-Score Anomaly Detection | Find unbooked occupancy surges |
| Demand Optimizer | Greedy Reallocation | Suggest moves from over to under-used |
| Temporal Pattern Miner | KMeans Clustering | Cluster time slots into behaviour archetypes |

---

## ✅ Complete Git History (All Steps)

```bash
git log --oneline
# ci: GitHub Pages auto-deploy workflow
# feat: full URIS dashboard — all AI panels wired and auto-refreshing
# feat: multi-source synthetic datasets — bookings, sensors, access logs, heatmap
# feat: KMeans temporal miner + feature importance visualisation
# feat: GBM no-show predictor + z-score informal usage detector
# feat: utilisation bar chart + demand heatmap canvas
# feat: synthetic data engine — bookings, occupancy, access logs
```
