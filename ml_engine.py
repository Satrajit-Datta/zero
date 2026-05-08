import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.preprocessing import LabelEncoder
from sklearn.cluster import KMeans
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')


# ─── 1. NO-SHOW PREDICTOR ────────────────────────────────────────────────────
class NoShowPredictor:
    FEATURES = ['lead_time_days','cancellation_history','booking_frequency',
                'day_of_week','is_weekend','start_hour','duration_hours']

    def __init__(self):
        self.model = GradientBoostingClassifier(n_estimators=150, max_depth=4,
                                                learning_rate=0.08, random_state=42)
        self.trained = False

    def fit(self, df: pd.DataFrame):
        X = df[self.FEATURES].fillna(0)
        y = (df['status'] == 'no_show').astype(int)
        self.model.fit(X, y)
        self.trained = True
        return self

    def predict_proba(self, df: pd.DataFrame):
        if not self.trained:
            raise RuntimeError("Model not trained")
        X = df[self.FEATURES].fillna(0)
        probs = self.model.predict_proba(X)[:, 1]
        importances = dict(zip(self.FEATURES, self.model.feature_importances_))
        return probs, importances

    def explain(self, row: pd.Series) -> list[str]:
        reasons = []
        if row.get('lead_time_days', 0) > 7:
            reasons.append(f"Long lead time ({row['lead_time_days']} days)")
        if row.get('cancellation_history', 0) >= 3:
            reasons.append(f"High cancellation history ({row['cancellation_history']})")
        if row.get('is_weekend', 0):
            reasons.append("Weekend booking")
        if row.get('start_hour', 12) >= 20:
            reasons.append("Late-evening slot")
        if row.get('booking_frequency', 10) < 3:
            reasons.append("Infrequent booker")
        return reasons or ["Moderate risk profile"]


# ─── 2. OCCUPANCY FORECASTER ─────────────────────────────────────────────────
class OccupancyForecaster:
    """Trend + seasonality decomposition → 24-h rolling forecast."""

    def forecast(self, occ_series: list[float], hours: int = 24) -> list[dict]:
        s = np.array(occ_series[-168:])  # up to last 7 days of hourly data
        if len(s) < 24:
            s = np.tile(s, 24)[:168]

        period = 24
        trend  = np.convolve(s, np.ones(period)/period, mode='same')
        seasonal = np.array([np.mean(s[i::period]) for i in range(period)])

        results = []
        for h in range(hours):
            idx     = h % period
            base    = seasonal[idx] * 0.6 + trend[-1] * 0.4
            noise   = np.random.normal(0, 0.03)
            pred    = float(np.clip(base + noise, 0, 1))
            ci      = 0.06 + 0.003 * h
            results.append({
                'hour': h,
                'predicted': round(pred, 3),
                'lower':     round(max(0, pred - ci), 3),
                'upper':     round(min(1, pred + ci), 3),
            })
        return results


# ─── 3. INFORMAL USAGE DETECTOR ──────────────────────────────────────────────
class InformalUsageDetector:
    def __init__(self, contamination=0.12):
        self.model = Pipeline([
            ('scaler', StandardScaler()),
            ('iso',    IsolationForest(contamination=contamination,
                                       n_estimators=100, random_state=42)),
        ])
        self.trained = False

    def fit(self, occ_df: pd.DataFrame):
        X = occ_df[['actual_occupancy','reserved_occupancy','hour','day_of_week']].fillna(0)
        self.model.fit(X)
        self.trained = True
        return self

    def detect(self, occ_df: pd.DataFrame) -> pd.DataFrame:
        if not self.trained:
            self.fit(occ_df)
        X = occ_df[['actual_occupancy','reserved_occupancy','hour','day_of_week']].fillna(0)
        occ_df = occ_df.copy()
        occ_df['anomaly_score'] = -self.model.named_steps['iso'].score_samples(
            self.model.named_steps['scaler'].transform(X))
        occ_df['is_anomaly']    = self.model.predict(X) == -1
        occ_df['surplus']       = (occ_df['actual_occupancy'] - occ_df['reserved_occupancy']).round(3)
        return occ_df[occ_df['is_anomaly']]


# ─── 4. DEMAND OPTIMIZER ─────────────────────────────────────────────────────
class DemandOptimizer:
    """Greedy reallocation: moves demand from overcrowded to underused spaces."""

    def optimize(self, spaces: list[dict], util_map: dict[str, float]) -> list[dict]:
        overcrowded   = [(s, util_map.get(s['id'], 0.5))
                         for s in spaces if util_map.get(s['id'], 0.5) > 0.80]
        underutilized = [(s, util_map.get(s['id'], 0.5))
                         for s in spaces if util_map.get(s['id'], 0.5) < 0.40]
        recs = []
        for (oc_sp, oc_util), (un_sp, un_util) in zip(overcrowded, underutilized):
            if oc_sp['type'] != un_sp['type']:
                continue
            shift = round((oc_util - 0.70) * oc_sp['capacity'])
            if shift <= 0:
                continue
            recs.append({
                'from_space':    oc_sp['name'],
                'to_space':      un_sp['name'],
                'space_type':    oc_sp['type'],
                'shift_units':   shift,
                'from_util':     round(oc_util * 100, 1),
                'to_util':       round(un_util * 100, 1),
                'expected_gain': round((0.70 - un_util) * 100, 1),
                'rationale':     (f"Redirect ~{shift} units from {oc_sp['name']} "
                                  f"({oc_util*100:.0f}% full) to {un_sp['name']} "
                                  f"({un_util*100:.0f}% full) — same type."),
            })
        return recs[:6]


# ─── 5. TEMPORAL PATTERN MINER ───────────────────────────────────────────────
class TemporalPatternMiner:
    CLUSTER_LABELS = {0: 'Morning Rush', 1: 'Midday Steady',
                      2: 'Evening Peak',  3: 'Off-Peak Night'}

    def __init__(self, n_clusters=4):
        self.n_clusters = n_clusters
        self.model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        self.scaler = StandardScaler()
        self.trained = False

    def fit_predict(self, occ_df: pd.DataFrame) -> pd.DataFrame:
        feats = ['actual_occupancy','reserved_occupancy','hour','day_of_week']
        X = occ_df[feats].fillna(0)
        Xs = self.scaler.fit_transform(X)
        occ_df = occ_df.copy()
        occ_df['cluster']       = self.model.fit_predict(Xs)
        occ_df['cluster_label'] = occ_df['cluster'].map(self.CLUSTER_LABELS)
        self.trained = True
        return occ_df

    def cluster_stats(self, occ_df: pd.DataFrame) -> list[dict]:
        df = self.fit_predict(occ_df)
        stats = []
        for c in range(self.n_clusters):
            sub = df[df['cluster'] == c]
            stats.append({
                'cluster':     c,
                'label':       self.CLUSTER_LABELS[c],
                'avg_actual':  round(sub['actual_occupancy'].mean(), 3),
                'avg_reserved':round(sub['reserved_occupancy'].mean(), 3),
                'peak_hour':   int(sub['hour'].mode()[0]),
                'count':       len(sub),
            })
        return stats


# ─── Facade ──────────────────────────────────────────────────────────────────
class MLEngine:
    def __init__(self, simulator):
        self.sim      = simulator
        self.nsp      = NoShowPredictor()
        self.forecaster = OccupancyForecaster()
        self.anomaly  = InformalUsageDetector()
        self.optimizer = DemandOptimizer()
        self.miner    = TemporalPatternMiner()
        self._train()

    def _train(self):
        df = pd.DataFrame(self.sim.get_bookings())
        self.nsp.fit(df)

    def get_noshow_risks(self, top_n=20) -> list[dict]:
        df = pd.DataFrame(self.sim.get_bookings())
        df = df[df['status'] == 'confirmed'].copy()
        probs, imps = self.nsp.predict_proba(df)
        df['risk_score'] = probs
        df['risk_level'] = pd.cut(probs, bins=[0,.3,.6,1],
                                   labels=['Low','Medium','High'])
        df['reasons']    = df.apply(self.nsp.explain, axis=1)
        top = df.nlargest(top_n, 'risk_score')[
            ['booking_id','space_id','space_type','user_id',
             'start_hour','day_of_week','risk_score','risk_level','reasons']
        ]
        top['risk_score'] = top['risk_score'].round(3)
        return top.to_dict('records')

    def get_occupancy_forecast(self, space_id: str) -> list[dict]:
        occ = pd.DataFrame(self.sim.get_occupancy(space_id, days=14))
        series = occ.sort_values('timestamp')['actual_occupancy'].tolist()
        return self.forecaster.forecast(series)

    def get_anomalies(self, space_id: str) -> list[dict]:
        occ = pd.DataFrame(self.sim.get_occupancy(space_id, days=7))
        res = self.anomaly.detect(occ)
        return res[['timestamp','hour','day_of_week',
                     'actual_occupancy','reserved_occupancy',
                     'surplus','anomaly_score']].head(20).to_dict('records')

    def get_optimization(self) -> list[dict]:
        spaces = self.sim.get_spaces()
        util_map = {s['id']: round(np.random.uniform(0.20, 0.95), 2) for s in spaces}
        return self.optimizer.optimize(spaces, util_map)

    def get_temporal_patterns(self, space_id: str) -> list[dict]:
        occ = pd.DataFrame(self.sim.get_occupancy(space_id, days=30))
        return self.miner.cluster_stats(occ)

    def get_heatmap(self) -> list[dict]:
        rows = []
        for dow in range(7):
            for h in range(24):
                base = 0.4
                if 8 <= h <= 10 or 17 <= h <= 19: base = 0.78
                elif 11 <= h <= 16: base = 0.62
                elif 20 <= h <= 22: base = 0.50
                elif h < 6:         base = 0.08
                if dow >= 5: base = base * 1.1 if h in range(10,20) else base * 0.65
                rows.append({'day': dow, 'hour': h,
                              'intensity': round(float(np.clip(base + np.random.normal(0,.05),0,1)),3)})
        return rows
