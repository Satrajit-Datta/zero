from fastapi import APIRouter, HTTPException
from typing import Optional

router = APIRouter(prefix="/api", tags=["URIS"])

# engine & simulator are injected by main.py
_engine = None
_sim    = None

def init(engine, simulator):
    global _engine, _sim
    _engine = engine
    _sim    = simulator


@router.get("/dashboard/summary")
def dashboard_summary():
    return _sim.get_dashboard_summary()


@router.get("/spaces")
def list_spaces():
    import numpy as np
    spaces = _sim.get_spaces()
    result = []
    for s in spaces:
        util = round(float(np.random.uniform(0.20, 0.95)), 2)
        status = "overcrowded" if util > 0.80 else ("underutilized" if util < 0.35 else "normal")
        result.append({**s, "utilization": util, "status": status})
    return result


@router.get("/occupancy/forecast/{space_id}")
def occupancy_forecast(space_id: str, hours: int = 24):
    try:
        return _engine.get_occupancy_forecast(space_id)[:hours]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/noshow/risk")
def noshow_risk(top_n: int = 20):
    return _engine.get_noshow_risks(top_n=top_n)


@router.get("/anomalies/{space_id}")
def anomalies(space_id: str):
    return _engine.get_anomalies(space_id)


@router.get("/anomalies")
def anomalies_all():
    spaces = _sim.get_spaces()[:5]
    all_anomalies = []
    for s in spaces:
        items = _engine.get_anomalies(s["id"])
        for item in items:
            all_anomalies.append({**item, "space_id": s["id"], "space_name": s["name"]})
    return sorted(all_anomalies, key=lambda x: x.get("anomaly_score", 0), reverse=True)[:20]


@router.get("/heatmap")
def heatmap():
    return _engine.get_heatmap()


@router.get("/optimization/suggestions")
def optimization_suggestions():
    return _engine.get_optimization()


@router.get("/temporal/patterns/{space_id}")
def temporal_patterns(space_id: str):
    return _engine.get_temporal_patterns(space_id)


@router.get("/temporal/patterns")
def temporal_patterns_global():
    return _engine.get_temporal_patterns("SPC001")


@router.get("/bookings")
def bookings(limit: int = 100, space_id: Optional[str] = None):
    data = _sim.get_bookings()
    if space_id:
        data = [b for b in data if b["space_id"] == space_id]
    return data[:limit]
