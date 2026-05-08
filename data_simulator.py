import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

np.random.seed(42)
random.seed(42)

SPACE_TYPES = ['parking', 'sports_venue', 'coworking', 'study_zone', 'community_hall', 'shared_infrastructure']

SPACES = [
    {'id': 'SPC001', 'name': 'Central Parking A',     'type': 'parking',                'capacity': 200, 'lat': 51.5074, 'lng': -0.1278},
    {'id': 'SPC002', 'name': 'North Parking B',        'type': 'parking',                'capacity': 150, 'lat': 51.5130, 'lng': -0.1200},
    {'id': 'SPC003', 'name': 'East Parking C',         'type': 'parking',                'capacity': 180, 'lat': 51.5020, 'lng': -0.1150},
    {'id': 'SPC004', 'name': 'Arena Stadium',           'type': 'sports_venue',           'capacity': 500, 'lat': 51.5089, 'lng': -0.1300},
    {'id': 'SPC005', 'name': 'Community Sports Hall',  'type': 'sports_venue',           'capacity': 100, 'lat': 51.5050, 'lng': -0.1350},
    {'id': 'SPC006', 'name': 'Tennis Courts',           'type': 'sports_venue',           'capacity':  50, 'lat': 51.5110, 'lng': -0.1250},
    {'id': 'SPC007', 'name': 'Innovation Hub',          'type': 'coworking',              'capacity':  80, 'lat': 51.5060, 'lng': -0.1280},
    {'id': 'SPC008', 'name': 'Digital Lounge',          'type': 'coworking',              'capacity':  60, 'lat': 51.5080, 'lng': -0.1320},
    {'id': 'SPC009', 'name': 'Startup Dock',            'type': 'coworking',              'capacity':  90, 'lat': 51.5040, 'lng': -0.1260},
    {'id': 'SPC010', 'name': 'Library Zone A',          'type': 'study_zone',             'capacity': 120, 'lat': 51.5095, 'lng': -0.1290},
    {'id': 'SPC011', 'name': 'Library Zone B',          'type': 'study_zone',             'capacity':  80, 'lat': 51.5070, 'lng': -0.1310},
    {'id': 'SPC012', 'name': 'Reading Corner',          'type': 'study_zone',             'capacity':  40, 'lat': 51.5055, 'lng': -0.1270},
    {'id': 'SPC013', 'name': 'Town Hall',               'type': 'community_hall',         'capacity': 300, 'lat': 51.5085, 'lng': -0.1295},
    {'id': 'SPC014', 'name': 'Community Center',        'type': 'community_hall',         'capacity': 150, 'lat': 51.5100, 'lng': -0.1240},
    {'id': 'SPC015', 'name': 'Civic Square',            'type': 'community_hall',         'capacity': 200, 'lat': 51.5065, 'lng': -0.1330},
    {'id': 'SPC016', 'name': 'Power Grid Station',      'type': 'shared_infrastructure',  'capacity':  10, 'lat': 51.5015, 'lng': -0.1200},
    {'id': 'SPC017', 'name': 'Water Access Point',      'type': 'shared_infrastructure',  'capacity':   5, 'lat': 51.5125, 'lng': -0.1350},
    {'id': 'SPC018', 'name': 'EV Charging Hub',         'type': 'shared_infrastructure',  'capacity':  20, 'lat': 51.5035, 'lng': -0.1290},
    {'id': 'SPC019', 'name': 'Bike Sharing Dock',       'type': 'shared_infrastructure',  'capacity':  30, 'lat': 51.5090, 'lng': -0.1265},
    {'id': 'SPC020', 'name': 'Public WiFi Node',        'type': 'shared_infrastructure',  'capacity': 100, 'lat': 51.5075, 'lng': -0.1305},
]

TYPE_BASE_NOSHOW = {
    'parking': 0.22, 'sports_venue': 0.18, 'coworking': 0.14,
    'study_zone': 0.12, 'community_hall': 0.16, 'shared_infrastructure': 0.10,
}

def _noshow_prob(lead_time, cancel_hist, dow, hour, freq, stype):
    base = TYPE_BASE_NOSHOW.get(stype, 0.15)
    base += min(lead_time * 0.018, 0.18)
    base += cancel_hist * 0.045
    if dow >= 5: base -= 0.04
    if 9 <= hour <= 17: base -= 0.03
    if freq > 10: base -= 0.05
    return float(np.clip(base, 0.05, 0.85))


def generate_bookings(n=2000):
    rows = []
    for i in range(n):
        sp = random.choice(SPACES)
        dt = datetime.now() - timedelta(days=random.randint(0, 90))
        lead = random.randint(0, 14)
        hour = random.randint(6, 21)
        dur  = random.randint(1, 4)
        uid  = f"USR{random.randint(1, 500):04d}"
        ch   = random.randint(0, 5)
        freq = random.randint(1, 20)
        nsp  = _noshow_prob(lead, ch, dt.weekday(), hour, freq, sp['type'])
        p_c, p_n = 0.20, nsp * 0.45
        p_comp = max(0.01, 1 - 0.30 - p_c - p_n)
        status = np.random.choice(
            ['confirmed', 'cancelled', 'no_show', 'completed'],
            p=[0.30, p_c, p_n, p_comp])
        rows.append({
            'booking_id': f"BK{i:05d}", 'space_id': sp['id'],
            'space_type': sp['type'], 'user_id': uid,
            'booking_date': dt.isoformat(), 'lead_time_days': lead,
            'start_hour': hour, 'duration_hours': dur,
            'day_of_week': dt.weekday(), 'is_weekend': int(dt.weekday() >= 5),
            'cancellation_history': ch, 'booking_frequency': freq,
            'status': status, 'noshow_probability': round(nsp, 3),
        })
    return pd.DataFrame(rows)


def generate_occupancy_ts(space_id, days=30):
    sp  = next(s for s in SPACES if s['id'] == space_id)
    cap = sp['capacity']
    rows = []
    for d in range(days):
        dt = datetime.now() - timedelta(days=days - d)
        for h in range(24):
            if   6  <= h <=  9: base = 0.70
            elif 10 <= h <= 16: base = 0.60
            elif 17 <= h <= 20: base = 0.80
            elif 21 <= h <= 23: base = 0.20
            else:                base = 0.05
            if dt.weekday() >= 5:
                base *= 1.30 if sp['type'] in ['sports_venue','community_hall'] else 0.70
            actual   = float(np.clip(base + np.random.normal(0, 0.10), 0, 1))
            reserved = float(np.clip(actual - 0.10 + np.random.normal(0, 0.05), 0, 1))
            rows.append({
                'space_id': space_id,
                'timestamp': dt.replace(hour=h).isoformat(),
                'date': dt.date().isoformat(), 'hour': h,
                'day_of_week': dt.weekday(),
                'actual_occupancy': round(actual, 3),
                'reserved_occupancy': round(reserved, 3),
                'capacity': cap,
                'actual_count': int(actual * cap),
                'reserved_count': int(reserved * cap),
            })
    return pd.DataFrame(rows)


def generate_access_logs(n=5000):
    rows = []
    for i in range(n):
        sp = random.choice(SPACES)
        ts = datetime.now() - timedelta(
            days=random.randint(0, 30),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59))
        has_bk = random.random() > 0.15
        rows.append({
            'log_id': f"LOG{i:06d}", 'space_id': sp['id'],
            'timestamp': ts.isoformat(),
            'event_type': random.choice(['entry', 'exit']),
            'has_booking': has_bk, 'is_informal': not has_bk,
        })
    return pd.DataFrame(rows)


class DataSimulator:
    def __init__(self):
        self.spaces    = SPACES
        self.bookings  = generate_bookings(2000)
        self.access_logs = generate_access_logs(5000)

    def get_spaces(self): return self.spaces

    def get_bookings(self): return self.bookings.to_dict('records')

    def get_occupancy(self, space_id, days=7):
        return generate_occupancy_ts(space_id, days).to_dict('records')

    def get_access_logs(self): return self.access_logs.to_dict('records')

    def get_dashboard_summary(self):
        df  = self.bookings
        tot = len(df)
        return {
            'total_reservations':   tot,
            'noshow_rate':          round(len(df[df.status=='no_show'])/tot*100, 1),
            'cancellation_rate':    round(len(df[df.status=='cancelled'])/tot*100, 1),
            'avg_utilization_rate': 67.3,
            'informal_usage_count': int(self.access_logs.is_informal.sum()),
            'overcrowding_alerts':  random.randint(3, 8),
            'spaces_underutilized': random.randint(5, 10),
            'spaces_overcrowded':   random.randint(2, 5),
        }
