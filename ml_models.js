// ─── js/ml_models.js ─── Browser-side ML simulations ────────────────────────

const { clamp: _cl, randN: _rn } = (() => {
  const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
  const randN = (mu=0,s=1) => { const u=1-Math.random(),v=Math.random();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*s+mu; };
  return { clamp, randN };
})();

// ─── 1. NO-SHOW PREDICTOR ─────────────────────────────────────────────────────
const NoShowPredictor = {
  // Weighted scoring simulating a trained GBM
  WEIGHTS: {
    lead_time_days:      0.22,
    cancellation_history:0.28,
    booking_frequency:  -0.15,
    is_weekend:         -0.08,
    start_hour_risk:     0.12,
    space_type_risk:     0.18,
  },
  TYPE_RISK: {
    parking: 0.20, sports_venue: 0.16, coworking: 0.12,
    study_zone: 0.10, community_hall: 0.14, shared_infrastructure: 0.08,
  },
  predict(booking) {
    const w = this.WEIGHTS, t = this.TYPE_RISK;
    let score = 0.15;
    score += Math.min(booking.lead_time_days * 0.018, 0.20)   * (w.lead_time_days / 0.22);
    score += Math.min(booking.cancellation_history * 0.04, 0.18) * (w.cancellation_history / 0.28);
    score -= Math.min((booking.booking_frequency - 1) * 0.006, 0.10);
    if (booking.is_weekend) score -= 0.04;
    if (booking.start_hour >= 20 || booking.start_hour <= 7) score += 0.06;
    score += (t[booking.space_type] || 0.12);
    return _cl(score + _rn(0, 0.02), 0.03, 0.95);
  },
  explain(booking, score) {
    const reasons = [];
    if (booking.lead_time_days > 7) reasons.push(`📅 Long lead time (${booking.lead_time_days}d)`);
    if (booking.cancellation_history >= 3) reasons.push(`❌ ${booking.cancellation_history} prior cancellations`);
    if (booking.booking_frequency < 3) reasons.push('👤 Infrequent booker');
    if (booking.start_hour >= 20) reasons.push('🌙 Late-evening slot');
    if (booking.space_type === 'parking') reasons.push('🅿️ Parking: higher no-show rate');
    if (score > 0.60) reasons.push('⚠️ High composite risk score');
    return reasons.length ? reasons : ['✅ Moderate risk profile'];
  },
  riskLevel(score) {
    if (score >= 0.60) return 'High';
    if (score >= 0.30) return 'Medium';
    return 'Low';
  },
  getTopRisks(bookings, n = 20) {
    return bookings
      .filter(b => b.status === 'confirmed')
      .map(b => {
        const score = this.predict(b);
        return { ...b, risk_score: +score.toFixed(3),
          risk_level: this.riskLevel(score), reasons: this.explain(b, score) };
      })
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, n);
  },
  featureImportance() {
    return [
      { feature: 'Cancellation History', importance: 0.28 },
      { feature: 'Lead Time (days)',      importance: 0.22 },
      { feature: 'Space Type',            importance: 0.18 },
      { feature: 'Start Hour',            importance: 0.12 },
      { feature: 'Weekend Flag',          importance: 0.08 },
      { feature: 'Booking Frequency',     importance: 0.12 },
    ];
  }
};

// ─── 2. OCCUPANCY FORECASTER ──────────────────────────────────────────────────
const OccupancyForecaster = {
  forecast(series, hours = 24) {
    // Trend + 24-h seasonal decomposition
    const period = 24;
    const n = series.length;
    const seasonal = Array.from({length: period}, (_, i) => {
      const vals = [];
      for (let j = i; j < n; j += period) vals.push(series[j]);
      return vals.reduce((a,b)=>a+b,0) / (vals.length || 1);
    });
    const lastTrend = series.slice(-period).reduce((a,b)=>a+b,0) / period;
    const results = [];
    for (let h = 0; h < hours; h++) {
      const base = seasonal[h % period] * 0.55 + lastTrend * 0.45;
      const pred = _cl(base + _rn(0, 0.025), 0, 1);
      const ci   = 0.05 + 0.003 * h;
      results.push({
        hour: h, predicted: +pred.toFixed(3),
        lower: +_cl(pred - ci, 0, 1).toFixed(3),
        upper: +_cl(pred + ci, 0, 1).toFixed(3),
      });
    }
    return results;
  }
};

// ─── 3. INFORMAL USAGE DETECTOR ───────────────────────────────────────────────
const InformalUsageDetector = {
  detect(occTs) {
    // Z-score anomaly detection on (actual - reserved) surplus
    const surplus = occTs.map(r => r.actual_occupancy - r.reserved_occupancy);
    const mu  = surplus.reduce((a,b)=>a+b,0) / surplus.length;
    const std = Math.sqrt(surplus.map(v=>(v-mu)**2).reduce((a,b)=>a+b,0) / surplus.length);
    return occTs
      .map((r, i) => ({ ...r, surplus: +surplus[i].toFixed(3),
        anomaly_score: +Math.abs((surplus[i]-mu)/(std||1)).toFixed(3),
        is_anomaly: Math.abs((surplus[i]-mu)/(std||1)) > 1.8 }))
      .filter(r => r.is_anomaly)
      .sort((a,b) => b.anomaly_score - a.anomaly_score)
      .slice(0, 15);
  }
};

// ─── 4. DEMAND OPTIMIZER ──────────────────────────────────────────────────────
const DemandOptimizer = {
  optimize(spaces) {
    const overcrowded   = spaces.filter(s => s.utilization > 0.80);
    const underutilized = spaces.filter(s => s.utilization < 0.40);
    const recs = [];
    for (const oc of overcrowded) {
      const partner = underutilized.find(u => u.type === oc.type);
      if (!partner) continue;
      const shift = Math.round((oc.utilization - 0.70) * oc.capacity);
      if (shift <= 0) continue;
      recs.push({
        from_space: oc.name, to_space: partner.name,
        space_type: oc.type, shift_units: shift,
        from_util: +(oc.utilization*100).toFixed(1),
        to_util:   +(partner.utilization*100).toFixed(1),
        expected_gain: +((0.70 - partner.utilization)*100).toFixed(1),
        rationale: `Redirect ~${shift} units from ${oc.name} `
          + `(${(oc.utilization*100).toFixed(0)}% full) → ${partner.name} `
          + `(${(partner.utilization*100).toFixed(0)}% full).`,
      });
      if (recs.length >= 5) break;
    }
    return recs;
  }
};

// ─── 5. TEMPORAL PATTERN MINER ────────────────────────────────────────────────
const TemporalPatternMiner = {
  LABELS: ['🌅 Morning Rush','☀️ Midday Steady','🌆 Evening Peak','🌙 Off-Peak Night'],
  HOUR_RANGES: [[6,10],[10,17],[17,21],[0,6]],
  mine(occTs) {
    return this.LABELS.map((label, i) => {
      const [lo, hi] = this.HOUR_RANGES[i];
      const sub = occTs.filter(r => r.hour >= lo && r.hour < hi);
      if (!sub.length) return null;
      const avgActual   = sub.reduce((a,r)=>a+r.actual_occupancy,0)/sub.length;
      const avgReserved = sub.reduce((a,r)=>a+r.reserved_occupancy,0)/sub.length;
      const peakHour    = sub.reduce((a,r)=>r.actual_occupancy>a.actual_occupancy?r:a, sub[0]).hour;
      return {
        cluster: i, label, peak_hour: peakHour,
        avg_actual:   +avgActual.toFixed(3),
        avg_reserved: +avgReserved.toFixed(3),
        count: sub.length,
        gap: +(avgActual - avgReserved).toFixed(3),
      };
    }).filter(Boolean);
  },
  weekdayVsWeekend(occTs) {
    const weekday = occTs.filter(r => r.day_of_week < 5);
    const weekend = occTs.filter(r => r.day_of_week >= 5);
    const avg = arr => arr.reduce((a,r)=>a+r.actual_occupancy,0)/(arr.length||1);
    return {
      weekday_avg: +avg(weekday).toFixed(3),
      weekend_avg: +avg(weekend).toFixed(3),
      weekday_peak: weekday.sort((a,b)=>b.actual_occupancy-a.actual_occupancy)[0]?.hour ?? 17,
      weekend_peak: weekend.sort((a,b)=>b.actual_occupancy-a.actual_occupancy)[0]?.hour ?? 11,
    };
  }
};

window.MLModels = {
  NoShowPredictor,
  OccupancyForecaster,
  InformalUsageDetector,
  DemandOptimizer,
  TemporalPatternMiner,
};
