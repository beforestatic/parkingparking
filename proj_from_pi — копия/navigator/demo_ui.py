"""
Self-contained HTML for the demo map panel.
Polls GET /api/v1/lots/times-mockup-01 every 2 seconds.
"""

DEMO_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Times Parking — Live Status</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #1a1a1a;
      color: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }

    .card {
      background: #242424;
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden;
    }

    /* Header — Times brand: yellow + black */
    .header {
      background: #F7C12E;
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-logo {
      background: #111;
      color: #F7C12E;
      font-weight: 900;
      font-size: 1rem;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      letter-spacing: 0.05em;
    }
    .header-info h1 {
      font-size: 1rem;
      font-weight: 700;
      color: #111;
      line-height: 1.2;
    }
    .header-info p {
      font-size: 0.75rem;
      color: #444;
      margin-top: 1px;
    }

    /* Summary bar */
    .summary {
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #333;
    }
    .availability {
      font-size: 1.75rem;
      font-weight: 800;
    }
    .availability.available { color: #4ade80; }
    .availability.limited   { color: #facc15; }
    .availability.full      { color: #f87171; }
    .badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .badge.available { background: #14532d; color: #4ade80; }
    .badge.limited   { background: #713f12; color: #facc15; }
    .badge.full      { background: #7f1d1d; color: #f87171; }

    /* Tiers */
    .tiers { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

    .tier-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 0.5rem;
    }

    .spaces {
      display: flex;
      gap: 8px;
    }

    .space {
      flex: 1;
      aspect-ratio: 1 / 1.8;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 6px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      transition: background 0.3s, transform 0.15s;
      position: relative;
      cursor: default;
    }
    .space::before {
      content: "";
      position: absolute;
      inset: 6px 50% 30px;
      width: 2px;
      transform: translateX(-50%);
      border-radius: 2px;
      background: rgba(255,255,255,0.12);
    }
    .space.free     { background: #166534; color: #bbf7d0; }
    .space.occupied { background: #991b1b; color: #fecaca; }
    .space.unknown  { background: #374151; color: #9ca3af; }

    /* Footer */
    .footer {
      padding: 0.75rem 1.5rem;
      border-top: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .updated { font-size: 0.7rem; color: #666; }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #4ade80;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    .error-msg {
      font-size: 0.75rem;
      color: #f87171;
      text-align: center;
      padding: 0.5rem 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand-logo">T</div>
      <div class="header-info">
        <h1 id="lot-name">Times Parking (Mockup)</h1>
        <p id="lot-address">Demo Location</p>
      </div>
    </div>

    <div class="summary">
      <div>
        <div class="availability" id="avail-count">— / 10</div>
        <div style="font-size:0.75rem;color:#888;margin-top:2px;">spaces available</div>
      </div>
      <div class="badge" id="status-badge">—</div>
    </div>

    <div class="tiers" id="tiers-container">
      <p class="error-msg" id="loading-msg">Loading…</p>
    </div>

    <div class="footer">
      <span class="updated" id="last-updated">—</span>
      <div class="dot" id="pulse-dot"></div>
    </div>
  </div>

  <script>
    const LOT_ID = "times-mockup-01";
    const API_URL = `/api/v1/lots/${LOT_ID}`;
    const POLL_MS = 2000;
    const $ = id => document.getElementById(id);

    function renderTier(tier) {
      const wrap = document.createElement("div");
      wrap.innerHTML = `<div class="tier-label">${tier.label}</div>`;
      const row = document.createElement("div");
      row.className = "spaces";
      tier.spaces.forEach(sp => {
        const el = document.createElement("div");
        el.className = `space ${sp.status}`;
        el.title = `${sp.label}: ${sp.status}`;
        el.textContent = sp.id;
        row.appendChild(el);
      });
      wrap.appendChild(row);
      return wrap;
    }

    async function poll() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        $("lot-name").textContent    = data.name;
        $("lot-address").textContent = data.address;
        $("avail-count").textContent = `${data.free_spaces} / ${data.total_spaces}`;
        $("avail-count").className   = `availability ${data.status}`;

        const badge = $("status-badge");
        badge.className  = `badge ${data.status}`;
        badge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);

        const container = $("tiers-container");
        container.innerHTML = "";
        data.tiers.forEach(t => container.appendChild(renderTier(t)));

        const ts = data.last_updated
          ? new Date(data.last_updated).toLocaleTimeString()
          : "no data yet";
        $("last-updated").textContent = `Updated ${ts}`;
        $("pulse-dot").style.background = "#4ade80";
      } catch (err) {
        $("tiers-container").innerHTML = `<p class="error-msg">&#9888; ${err.message}</p>`;
        $("pulse-dot").style.background = "#f87171";
      }
    }

    poll();
    setInterval(poll, POLL_MS);
  </script>
</body>
</html>"""
