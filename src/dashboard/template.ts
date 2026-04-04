function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --bg: #08111f;
      --panel: rgba(10, 23, 43, 0.86);
      --border: rgba(151, 187, 255, 0.18);
      --text: #edf4ff;
      --muted: #8da3c7;
      --accent: #31d0aa;
      --accent-2: #5aa0ff;
      --danger: #ff6f7d;
      --shadow: 0 20px 50px rgba(2, 7, 18, 0.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(49, 208, 170, 0.16), transparent 32%),
        radial-gradient(circle at top right, rgba(90, 160, 255, 0.22), transparent 28%),
        linear-gradient(180deg, #08111f 0%, #0b1525 100%);
      min-height: 100vh;
    }
    .shell { max-width: 1280px; margin: 0 auto; padding: 24px; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 22px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }
    .muted { color: var(--muted); }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .ok { color: var(--accent); }
    .fail { color: var(--danger); }
    .grid { display: grid; gap: 18px; }
    .cards { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .card {
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 18px;
    }
    .card h3 {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .card strong {
      display: block;
      font-size: 28px;
      line-height: 1.1;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
    }
    .feed { max-height: 520px; overflow: auto; }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    button, input { font: inherit; }
    button {
      border: 0;
      border-radius: 14px;
      padding: 12px 16px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #04101d;
      font-weight: 700;
      cursor: pointer;
    }
    .ghost {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .login-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 20px;
    }
    .login-card { width: min(420px, 100%); padding: 28px; }
    .login-card h1 { margin: 0 0 8px; font-size: 30px; }
    .login-card p { margin: 0 0 24px; color: var(--muted); }
    .field { display: grid; gap: 8px; margin-bottom: 16px; }
    .field input {
      width: 100%;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
    }
    .error {
      margin-bottom: 16px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255, 111, 125, 0.24);
      background: rgba(255, 111, 125, 0.08);
      color: #ffd5da;
    }
    @media (max-width: 860px) {
      .shell { padding: 14px; }
      .grid.two { grid-template-columns: 1fr !important; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function renderLoginPage(errorMessage?: string): string {
  const errorBlock = errorMessage
    ? `<div class="error">${escapeHtml(errorMessage)}</div>`
    : '';

  return pageShell(
    'Matcher Admin Login',
    `<main class="login-shell">
      <section class="panel login-card">
        <span class="badge">Admin Panel</span>
        <h1>Realtime Matcher Console</h1>
        <p>Login to view platform status, order feed, and matched account activity.</p>
        ${errorBlock}
        <form method="post" action="/panel/login">
          <label class="field">
            <span>Admin ID</span>
            <input type="text" name="adminId" autocomplete="username" required />
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button type="submit">Open Dashboard</button>
        </form>
      </section>
    </main>`,
  );
}

export function renderDashboardPage(adminId: string): string {
  const safeAdminId = escapeHtml(adminId);

  return pageShell(
    'Matcher Dashboard',
    `<main class="shell">
      <section class="panel" style="padding:24px;">
        <div class="toolbar">
          <div>
            <span class="badge">Admin Access</span>
            <h1 style="margin:12px 0 8px; font-size:34px;">Realtime Payment Matcher</h1>
            <p class="muted" style="margin:0;">Signed in as <strong>${safeAdminId}</strong>. Live platform fetches, order flow, and matched account feed stream here.</p>
          </div>
          <div class="toolbar">
            <span id="sync-state" class="badge">Connecting</span>
            <form method="post" action="/panel/logout">
              <button class="ghost" type="submit">Logout</button>
            </form>
          </div>
        </div>

        <section class="grid cards" id="summary-cards" style="margin-top:24px;"></section>

        <section class="grid two" style="grid-template-columns: 1.4fr 1fr; margin-top:24px;">
          <article class="card">
            <div class="toolbar" style="margin-bottom:10px;">
              <h2 style="margin:0; font-size:16px;">Platform Status</h2>
              <span class="muted" id="snapshot-time">Waiting for data</span>
            </div>
            <div class="feed">
              <table>
                <thead><tr><th>Platform</th><th>Status</th><th>Fetched</th><th>Matches</th><th>Last Poll</th></tr></thead>
                <tbody id="platform-table"></tbody>
              </table>
            </div>
          </article>

          <article class="card">
            <div class="toolbar" style="margin-bottom:10px;">
              <h2 style="margin:0; font-size:16px;">Storage</h2>
              <span id="storage-mode" class="badge">Runtime</span>
            </div>
            <div id="storage-details" class="muted" style="display:grid; gap:10px;"></div>
          </article>
        </section>

        <section class="grid two" style="grid-template-columns: 1fr 1fr; margin-top:24px;">
          <article class="card">
            <h2 style="margin:0 0 10px; font-size:16px;">Recent Matches</h2>
            <div class="feed">
              <table>
                <thead><tr><th>Order</th><th>Platform</th><th>Amount</th><th>Matched Account</th><th>Subagent</th></tr></thead>
                <tbody id="match-table"></tbody>
              </table>
            </div>
          </article>

          <article class="card">
            <h2 style="margin:0 0 10px; font-size:16px;">Recent Orders</h2>
            <div class="feed">
              <table>
                <thead><tr><th>Order</th><th>Platform</th><th>Amount</th><th>Account</th><th>Seen</th></tr></thead>
                <tbody id="order-table"></tbody>
              </table>
            </div>
          </article>
        </section>
      </section>
    </main>
    <script>
      const formatTime = (value) => value ? new Date(value).toLocaleString() : 'Never';
      const formatMoney = (value) => typeof value === 'number' ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
      const byId = (id) => document.getElementById(id);

      function renderSummary(snapshot) {
        const cards = [
          ['Accounts', snapshot.accountCount],
          ['Match Buckets', snapshot.matchBucketCount],
          ['Observed Orders', snapshot.totalObservedOrders],
          ['Matched Orders', snapshot.totalMatchedOrders],
        ];
        byId('summary-cards').innerHTML = cards.map(([label, value]) => '<article class="card"><h3>' + label + '</h3><strong>' + value + '</strong></article>').join('');
      }

      function renderPlatforms(snapshot) {
        byId('platform-table').innerHTML = snapshot.platforms.map((platform) => '<tr>'
          + '<td><strong>' + platform.platformId.toUpperCase() + '</strong></td>'
          + '<td class="' + (platform.lastRunSuccess ? 'ok' : 'fail') + '">' + (platform.lastRunSuccess ? 'OK' : 'FAIL') + '</td>'
          + '<td>' + platform.lastResultsCount + '</td>'
          + '<td>' + platform.totalMatchesFound + '</td>'
          + '<td>' + formatTime(platform.lastPoll) + '</td>'
          + '</tr>').join('') || '<tr><td colspan="5" class="muted">No platform activity yet.</td></tr>';
      }

      function renderMatches(snapshot) {
        byId('match-table').innerHTML = snapshot.recentMatches.map((event) => '<tr>'
          + '<td><strong>' + event.orderNo + '</strong><div class="muted">' + formatTime(event.matchedAt || event.receivedAt) + '</div></td>'
          + '<td>' + event.platform + '</td>'
          + '<td>' + formatMoney(event.amount) + '</td>'
          + '<td>' + (event.matchedAccountNo || 'N/A') + '<div class="muted">' + (event.matchedHolderName || 'Unknown') + '</div></td>'
          + '<td>' + (event.matchedSubagentName || event.matchedSubagentId || 'N/A') + '</td>'
          + '</tr>').join('') || '<tr><td colspan="5" class="muted">No matches yet.</td></tr>';
      }

      function renderOrders(snapshot) {
        byId('order-table').innerHTML = snapshot.recentOrders.map((event) => '<tr>'
          + '<td><strong>' + event.orderNo + '</strong><div class="muted">' + (event.matched ? 'Matched' : 'Observed') + '</div></td>'
          + '<td>' + event.platform + '</td>'
          + '<td>' + formatMoney(event.amount) + '</td>'
          + '<td>' + event.acctNo + '<div class="muted">' + event.acctCode + '</div></td>'
          + '<td>' + formatTime(event.receivedAt) + '</td>'
          + '</tr>').join('') || '<tr><td colspan="5" class="muted">No observed orders yet.</td></tr>';
      }

      function renderStorage(snapshot) {
        byId('storage-mode').textContent = snapshot.storage.mode.toUpperCase();
        byId('storage-details').innerHTML = [
          '<div><strong>State:</strong> ' + snapshot.storage.state + '</div>',
          '<div><strong>Target Table:</strong> ' + snapshot.storage.table + '</div>',
          '<div><strong>Subagent:</strong> ' + (snapshot.targetSubagentId || 'ALL') + '</div>'
        ].join('');
      }

      async function loadDashboard() {
        const response = await fetch('/panel/api/dashboard', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Dashboard request failed with ' + response.status);
        const snapshot = await response.json();
        renderSummary(snapshot);
        renderPlatforms(snapshot);
        renderMatches(snapshot);
        renderOrders(snapshot);
        renderStorage(snapshot);
        byId('snapshot-time').textContent = 'Updated ' + formatTime(snapshot.generatedAt);
      }

      let refreshing = false;
      async function refresh() {
        if (refreshing) return;
        refreshing = true;
        try {
          await loadDashboard();
          byId('sync-state').textContent = 'Live';
        } catch (error) {
          console.error(error);
          byId('sync-state').textContent = 'Retrying';
        } finally {
          refreshing = false;
        }
      }

      refresh();

      const stream = new EventSource('/panel/api/stream');
      stream.onmessage = () => refresh();
      stream.onerror = () => { byId('sync-state').textContent = 'Disconnected'; };

      setInterval(refresh, 10000);
    </script>`,
  );
}
