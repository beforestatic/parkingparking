import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.environ.get("DB_PATH", "parking_data.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS ingest_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lot_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            source TEXT DEFAULT 'camera',
            total_spaces INTEGER,
            free_spaces INTEGER,
            occupied_spaces INTEGER,
            availability_pct REAL,
            raw_json TEXT
        );

        CREATE TABLE IF NOT EXISTS space_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lot_id TEXT NOT NULL,
            space_id TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            source TEXT DEFAULT 'camera',
            edge_pct REAL,
            diff_pct REAL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            mode TEXT,
            total_updates INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS error_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            component TEXT NOT NULL,
            error_type TEXT NOT NULL,
            message TEXT,
            detail TEXT
        );
    """)
    conn.commit()
    conn.close()
    print(f"[db] Initialized at {DB_PATH}")

def log_ingest(lot_id, timestamp, source, total, free, occupied, raw_json):
    conn = get_db()
    conn.execute("""
        INSERT INTO ingest_log 
        (lot_id, timestamp, source, total_spaces, free_spaces, occupied_spaces, availability_pct, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        lot_id, timestamp, source, total, free, occupied,
        round(free / total * 100, 1) if total > 0 else 0,
        raw_json
    ))
    conn.commit()
    conn.close()

def log_space_event(lot_id, space_id, status, timestamp, source, edge_pct=None, diff_pct=None):
    conn = get_db()
    conn.execute("""
        INSERT INTO space_events
        (lot_id, space_id, status, timestamp, source, edge_pct, diff_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (lot_id, space_id, status, timestamp, source, edge_pct, diff_pct))
    conn.commit()
    conn.close()

def log_error(component: str, error_type: str, message: str, detail: str = None):
    """
    Log a failure or warning event.

    Parameters
    ----------
    component:   which part of the system failed, e.g. 'navigator_push',
                 'camera', 'sensor_reader', 'detection'
    error_type:  short category, e.g. 'connection_error', 'timeout',
                 'frame_drop', 'sensor_timeout', 'auth_error'
    message:     human-readable description
    detail:      optional extra context (exception string, HTTP status, etc.)
    """
    try:
        conn = get_db()
        conn.execute("""
            INSERT INTO error_log (timestamp, component, error_type, message, detail)
            VALUES (?, ?, ?, ?, ?)
        """, (
            datetime.now(timezone.utc).isoformat(),
            component, error_type, message, detail
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        # Never let logging crash the main process
        print(f"[db] error_log write failed: {e}", flush=True)

def get_errors(limit=100, component=None):
    conn = get_db()
    if component:
        rows = conn.execute("""
            SELECT * FROM error_log
            WHERE component=?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (component, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT * FROM error_log
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def start_session(mode):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO sessions (started_at, mode) VALUES (?, ?)",
        (datetime.now(timezone.utc).isoformat(), mode)
    )
    session_id = cur.lastrowid
    conn.commit()
    conn.close()
    return session_id

def end_session(session_id, total_updates):
    conn = get_db()
    conn.execute(
        "UPDATE sessions SET ended_at=?, total_updates=? WHERE id=?",
        (datetime.now(timezone.utc).isoformat(), total_updates, session_id)
    )
    conn.commit()
    conn.close()

def get_history(lot_id, limit=100):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM ingest_log 
        WHERE lot_id=? 
        ORDER BY timestamp DESC 
        LIMIT ?
    """, (lot_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_space_events(lot_id, limit=100):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM space_events
        WHERE lot_id=?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (lot_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

if __name__ == "__main__":
    init_db()
    print("[db] Test insert...")
    log_ingest("times-mockup-01", datetime.now(timezone.utc).isoformat(),
               "camera", 5, 3, 2, "{}")
    log_error("navigator_push", "connection_error", "Could not reach navigator", "ConnectionRefusedError")
    print("[db] Errors:", get_errors())
    print("[db] Done")
