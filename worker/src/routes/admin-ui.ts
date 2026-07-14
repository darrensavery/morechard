/**
 * GET /admin
 *
 * Self-contained browser admin panel. Returns a single HTML page with
 * inline CSS and JS. All API calls are made from the browser back to the
 * same worker origin using the X-Admin-Key header entered at login.
 *
 * No external dependencies — works as long as the worker is reachable.
 *
 * XSS mitigation: all user-supplied content is inserted via textContent or
 * setAttribute with safe values. No innerHTML is constructed from server data.
 * onclick handlers reference data stored in JS Maps keyed by locale/id, not
 * embedded in HTML attributes.
 */

export function serveAdminUI(): Response {
  const html = buildHtml();
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morechard Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --brand-primary:   #00959c;
    --brand-accent:    #e6b222;
    --brand-deep:      #1b2d2e;
    --brand-parchment: #f9f7f2;
    --teal-dark:       #007a7f;
    --surface:         #ffffff;
    --surface-alt:     #f3f2ee;
    --border:          #d3d1c7;
    --text:            #1c1c1a;
    --muted:           #6b6a66;
    --red:             #dc2626;
    --radius:          12px;
    --font:            'Inter', system-ui, -apple-system, sans-serif;
    --mono:            'JetBrains Mono', monospace;
    --max-w:           860px;
  }
  body { background: var(--brand-parchment); color: var(--text); font-family: var(--font); font-size: 14px; min-height: 100vh; -webkit-font-smoothing: antialiased; }

  /* ── Login ── */
  #login { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .login-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 40px; width: 100%; max-width: 380px;
    box-shadow: 0 4px 24px rgba(27,45,46,.10);
  }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .login-logo-text { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: var(--brand-deep); }
  .login-logo-badge { font-size: 10px; font-weight: 700; background: var(--brand-accent); color: var(--brand-deep); border-radius: 4px; padding: 2px 7px; margin-left: 4px; vertical-align: middle; letter-spacing: .04em; }
  .login-card p.sub { color: var(--muted); font-size: 13px; margin-bottom: 24px; line-height: 1.55; }
  label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .07em; }
  input[type=password], input[type=text], input[type=number] {
    width: 100%; background: var(--brand-parchment); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); padding: 10px 14px; font-size: 14px; font-family: var(--font); outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  input:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(0,149,156,.12); }
  .mt { margin-top: 16px; }

  /* ── Buttons ── */
  button { cursor: pointer; font-family: var(--font); font-size: 13px; font-weight: 600; border: none; border-radius: 8px; padding: 9px 18px; transition: opacity .15s, background .15s; }
  button:hover:not(:disabled) { opacity: .85; }
  button:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--brand-primary); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: var(--teal-dark); opacity: 1; }
  .btn-danger  { background: var(--red); color: #fff; }
  .btn-ghost   { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover:not(:disabled) { border-color: #a8a69e; opacity: 1; }
  .btn-sm      { padding: 5px 12px; font-size: 12px; border-radius: 6px; }
  .btn-full    { width: 100%; margin-top: 20px; padding: 11px; font-size: 14px; }

  /* ── Shell ── */
  #app { display: none; flex-direction: column; min-height: 100vh; }

  /* Header — matches app's glass-header: white surface, subtle border, centered content */
  header {
    background: rgba(255,255,255,.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; flex-shrink: 0;
  }
  .header-inner {
    max-width: var(--max-w); margin: 0 auto; padding: 0 20px;
    height: 56px; display: flex; align-items: center; justify-content: space-between;
  }
  .header-logo { display: flex; align-items: center; gap: 9px; }
  .header-wordmark { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; color: var(--brand-deep); }
  .badge { font-size: 10px; font-weight: 700; background: var(--brand-accent); color: var(--brand-deep); border-radius: 4px; padding: 2px 7px; margin-left: 5px; vertical-align: middle; letter-spacing: .04em; }
  .sign-out { color: var(--muted); font-size: 13px; font-weight: 500; cursor: pointer; background: none; border: none; font-family: var(--font); transition: color .15s; padding: 6px 10px; border-radius: 6px; }
  .sign-out:hover { color: var(--text); background: var(--surface-alt); opacity: 1; }

  /* Nav — same tab-bar style as the app */
  nav { border-bottom: 1px solid var(--border); background: rgba(255,255,255,.85); backdrop-filter: blur(12px); }
  .nav-inner { max-width: var(--max-w); margin: 0 auto; padding: 0 20px; display: flex; gap: 0; }
  nav button {
    background: none; color: var(--muted); border: none; border-radius: 0;
    border-bottom: 2px solid transparent; padding: 13px 16px;
    font-size: 13px; font-weight: 500; transition: color .15s, border-color .15s; white-space: nowrap;
  }
  nav button:hover:not(:disabled) { color: var(--text); opacity: 1; }
  nav button.active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); font-weight: 600; }

  /* ── Content ── */
  main { flex: 1; }
  .content-inner { max-width: var(--max-w); margin: 0 auto; padding: 32px 20px; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* ── Cards ── */
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 24px; margin-bottom: 24px;
    box-shadow: 0 1px 4px rgba(27,45,46,.06);
  }
  .card h2 { font-size: 14px; font-weight: 600; margin-bottom: 6px; letter-spacing: -0.01em; color: var(--brand-deep); }
  .card p.desc { color: var(--muted); font-size: 12px; margin-bottom: 20px; line-height: 1.6; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); padding: 8px 14px; border-bottom: 1px solid var(--border); }
  td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--brand-parchment); }
  .mono { font-family: var(--mono); font-size: 12.5px; }
  .muted { color: var(--muted); }

  /* ── Inline edit ── */
  .edit-row { display: none; }
  .edit-row.open { display: table-row; }
  .edit-row td { background: var(--surface-alt); padding: 14px; border-bottom: 1px solid var(--border); }
  .edit-form { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .edit-form .field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 130px; }
  .edit-form input { margin: 0; }

  /* ── Candidate cards ── */
  .candidate {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 18px 20px; margin-bottom: 12px;
    display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
    box-shadow: 0 1px 4px rgba(27,45,46,.06); transition: border-color .15s;
  }
  .candidate:hover { border-color: #a8a69e; }
  .candidate-info h3 { font-size: 14px; font-weight: 600; margin-bottom: 5px; letter-spacing: -0.01em; }
  .candidate-info .meta { color: var(--muted); font-size: 12px; line-height: 1.5; }
  .candidate-actions { display: flex; gap: 8px; flex-shrink: 0; margin-top: 2px; }
  .pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px; letter-spacing: .03em; }
  .pill-teal { background: rgba(0,149,156,.10); color: var(--brand-primary); border: 1px solid rgba(0,149,156,.25); }
  .pill-gray { background: var(--surface-alt); color: var(--muted); border: 1px solid var(--border); }

  /* ── Create form ── */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 560px) { .form-grid { grid-template-columns: 1fr; } }

  /* ── Filter bar ── */
  .filter-bar { display: flex; gap: 8px; margin-bottom: 20px; }
  .filter-bar button.active { border-color: var(--brand-primary); color: var(--brand-primary); background: rgba(0,149,156,.06); }
  .filter-bar .field { display: flex; flex-direction: column; gap: 6px; }
  .filter-bar select {
    background: var(--brand-parchment); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); padding: 8px 12px; font-size: 13px; font-family: var(--font); outline: none;
    min-width: 150px; transition: border-color .15s, box-shadow .15s;
  }
  .filter-bar select:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(0,149,156,.12); }
  .review-source { display: inline-block; font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-alt); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; margin-left: 8px; text-transform: capitalize; letter-spacing: .02em; }

  /* ── Agent Review ── */
  .review-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; background: var(--surface); }
  .review-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .04em; }
  .badge-approve { background: #d6f5e3; color: #0a6b3d; }
  .badge-review  { background: #fdf0d5; color: #92620a; }
  .review-category { color: var(--muted); font-size: 12px; margin: 8px 0 4px; }
  .review-diagnosis { white-space: pre-wrap; font-family: var(--font); font-size: 13px; background: var(--brand-parchment); padding: 12px; border-radius: 8px; margin: 8px 0; }
  .review-tool { font-family: var(--mono); font-size: 12px; margin: 8px 0; }
  .review-draft { background: #f0f7f7; border-radius: 8px; padding: 12px; margin: 8px 0; font-size: 13px; }
  .review-draft-body { line-height: 1.6; }
  .review-draft-body p, .review-draft-body ul, .review-draft-body ol { margin: 0 0 10px; }
  .review-draft-body ul, .review-draft-body ol { padding-left: 20px; }
  .review-draft-body li { margin-bottom: 4px; }
  .review-draft-body > :last-child { margin-bottom: 0; }

  /* ── Toast ── */
  #toast {
    position: fixed; bottom: 28px; right: 28px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 13px 18px; font-size: 13px; font-weight: 500;
    box-shadow: 0 8px 30px rgba(27,45,46,.18); display: none; z-index: 999; max-width: 320px;
  }
  #toast.ok  { border-color: var(--brand-primary); color: var(--brand-primary); }
  #toast.err { border-color: var(--red); color: var(--red); }

  /* ── Misc ── */
  .empty { color: var(--muted); font-size: 13px; padding: 28px 0; text-align: center; }
  .spinner { display: inline-block; width: 15px; height: 15px; border: 2px solid var(--border); border-top-color: var(--brand-primary); border-radius: 50%; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #login-err { color: var(--red); font-size: 12px; margin-top: 10px; display: none; line-height: 1.5; }

  /* ── Info button ── */
  .info-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--surface-alt); border: 1px solid var(--border);
    color: var(--muted); font-size: 11px; font-weight: 700;
    cursor: pointer; margin-left: 8px; vertical-align: middle; flex-shrink: 0;
    transition: border-color .15s, color .15s;
  }
  .info-btn:hover:not(:disabled) { border-color: var(--brand-primary); color: var(--brand-primary); opacity: 1; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(27,45,46,.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 24px;
    opacity: 0; pointer-events: none; transition: opacity .2s;
  }
  .modal-overlay.open { opacity: 1; pointer-events: auto; }
  .modal {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 32px; max-width: 500px; width: 100%; position: relative;
    transform: translateY(10px); transition: transform .2s;
    box-shadow: 0 16px 48px rgba(27,45,46,.2);
  }
  .modal-overlay.open .modal { transform: translateY(0); }
  .modal h3 { font-size: 16px; font-weight: 700; margin-bottom: 14px; letter-spacing: -0.02em; color: var(--brand-deep); }
  .modal-close {
    position: absolute; top: 18px; right: 18px;
    background: var(--surface-alt); border: 1px solid var(--border); border-radius: 6px;
    color: var(--muted); font-size: 14px; cursor: pointer; line-height: 1; padding: 5px 8px;
    transition: color .15s, border-color .15s;
  }
  .modal-close:hover:not(:disabled) { color: var(--text); border-color: #a8a69e; opacity: 1; }
  .modal p { color: var(--muted); font-size: 13px; line-height: 1.65; margin-bottom: 12px; }
  .modal p:last-child { margin-bottom: 0; }
  .modal strong { color: var(--text); font-weight: 600; }
  .modal-section { border-top: 1px solid var(--border); margin-top: 20px; padding-top: 20px; }
  .modal-section h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--brand-primary); margin-bottom: 12px; }
</style>
</head>
<body>

<!-- Login -->
<div id="login">
  <div class="login-card">
    <div class="login-logo">
      <svg width="30" height="30" viewBox="0 0 441.06 442.31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="lm-grad" x1="0" y1="221.15" x2="441.06" y2="221.15" gradientUnits="userSpaceOnUse">
            <stop offset="0.5" stop-color="#00959c"/>
            <stop offset="0.5" stop-color="#e6b222"/>
          </linearGradient>
        </defs>
        <path fill="url(#lm-grad)" d="M427.64,1.69l-202.38,139.41c-.32.25-.66.46-1,.66-.1.06-.2.11-.3.16-.32.16-.64.32-.97.43-.02,0-.03,0-.05.02-.37.13-.75.22-1.13.29-.03,0-.06.01-.1.02-.39.06-.79.1-1.18.1-1.65,0-3.3-.56-4.74-1.67L13.42,1.69C7.64-2.79,0,2.16,0,10.37v421.58c0,5.72,3.89,10.35,8.68,10.35h168.33c5.21,0,9.82-3.37,11.4-8.33.98-3.06,2.13-6.89,3.34-11.35.39-1.44.79-2.95,1.18-4.52.2-.78.4-1.58.6-2.4.4-1.63.8-3.32,1.19-5.07.39-1.75.78-3.55,1.16-5.4.76-3.71,1.49-7.62,2.15-11.7.17-1.02.33-2.05.48-3.09.78-5.21,1.45-10.67,1.94-16.32.1-1.13.19-2.27.27-3.41,2.09-28.61-.6-61.56-15.95-90.46-2.45-4.62-5.23-9.14-8.37-13.53,0,0,27.23,16.74,44.08,54.11,16.85-37.37,44.08-54.11,44.08-54.11-41.71,58.29-20.37,141.01-11.99,167.25,1.58,4.96,6.19,8.32,11.4,8.32h168.37c4.8,0,8.68-4.64,8.68-10.35V10.37c0-8.22-7.64-13.16-13.42-8.68ZM278.05,203.52c8.68-1.11,17.68,2.48,23.07,10.14,5.39,7.65,5.76,17.33,1.79,25.14-8.68,1.11-17.68-2.48-23.07-10.14-5.39-7.65-5.76-17.33-1.79-25.14ZM257.86,182.83c6.09,2.37,10.04,7.85,10.75,13.92-4.62,4-11.24,5.38-17.33,3.02-6.09-2.37-10.04-7.85-10.75-13.92,4.62-4,11.24-5.38,17.33-3.02ZM220.5,174.69c5.02-.02,9.39,2.79,11.6,6.93-2.18,4.16-6.52,7.01-11.54,7.03-5.02.02-9.39-2.79-11.6-6.93,2.18-4.16,6.52-7.01,11.54-7.03ZM138.43,222.92c9.47-3.52,20.53-1.82,28.59,5.38,8.06,7.2,11,17.99,8.57,27.8-9.47,3.52-20.53,1.82-28.59-5.38-8.06-7.2-11-17.99-8.57-27.8ZM123.74,265.47c1.15-6.91,6.46-12.19,13.3-14.15,5.83,4.07,9.15,10.79,8,17.7-1.15,6.91-6.46,12.19-13.3,14.15-5.83-4.07-9.15-10.79-8-17.7ZM191.82,358.95c-8.69,3.37-18.99,1.94-26.68-4.63-7.69-6.56-10.72-16.52-8.74-25.63,8.69-3.37,18.99-1.94,26.68,4.63,7.69,6.56,10.72,16.52,8.74,25.63ZM182.94,308.24c-7.36,8.49-19.08,12.74-30.85,10.05-11.77-2.69-20.47-11.62-23.41-22.47,7.36-8.49,19.08-12.74,30.85-10.05,11.77,2.69,20.47,11.62,23.41,22.47ZM161.78,216.36c-1.43-10.47,2.82-21.36,12.01-27.94,9.18-6.59,20.86-7.12,30.32-2.41,1.43,10.47-2.82,21.36-12.01,27.94-9.18-6.59-20.86-7.12-30.32-2.41ZM186.67,236.75c2.82-12.73,12.45-22.19,24.21-25.42,9.29,7.9,14.02,20.54,11.2,33.27-2.82,12.73-12.45,22.19-24.21,25.42-9.29-7.9-14.02-20.54-11.2-33.27ZM231.53,285.81c-6.01,5.93-14.57,7.68-22.1,5.3-2.27-7.56-.4-16.09,5.62-22.02,6.01-5.93,14.57-7.68,22.1-5.3,2.27,7.56.4,16.09-5.62,22.02ZM239.57,247.8c-9.19-10.21-11.41-24.25-6.98-36.31,12.46-3.13,26.19.54,35.38,10.75,9.19,10.21,11.41,24.25,6.98,36.31-12.46,3.13-26.19-.54-35.38-10.75ZM279.72,349.22c-6.01,9.4-16.53,14.17-26.93,13.31-5.14-9.08-5.23-20.62.78-30.03,6.01-9.4,16.53-14.17,26.93-13.31,5.14,9.08,5.23,20.62-.78,30.03ZM262.83,307.05c-4.37-8.89-3.82-19.83,2.39-28.41,6.21-8.58,16.44-12.52,26.25-11.13,4.37,8.89,3.82,19.83-2.39,28.41-6.21,8.58-16.44,12.52-26.25,11.13ZM310.84,313.15c-3.42,7.3-10.51,11.71-18.04,12.07-4.54-6.02-5.69-14.28-2.27-21.58,3.42-7.3,10.51-11.71,18.04-12.07,4.54,6.02,5.69,14.28,2.27,21.58ZM309.95,281.38c-6.91-3.09-11.94-9.79-12.48-17.87-.54-8.08,3.55-15.39,9.99-19.37,6.91,3.09,11.94,9.79,12.48,17.87.54,8.08-3.55,15.39-9.99,19.37Z"/>
      </svg>
      <span class="login-logo-text">Morechard <span class="login-logo-badge">ADMIN</span></span>
    </div>
    <p class="sub">Enter your admin key to continue</p>
    <label for="key-input">Admin key</label>
    <input type="password" id="key-input" autocomplete="current-password">
    <p id="login-err"></p>
    <button class="btn-primary btn-full" id="login-btn">Sign in</button>
  </div>
</div>

<!-- App shell -->
<div id="app">
  <header>
    <div class="header-inner">
      <div class="header-logo">
        <svg width="26" height="26" viewBox="0 0 441.06 442.31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="hm-grad" x1="0" y1="221.15" x2="441.06" y2="221.15" gradientUnits="userSpaceOnUse">
              <stop offset="0.5" stop-color="#00959c"/>
              <stop offset="0.5" stop-color="#e6b222"/>
            </linearGradient>
          </defs>
          <path fill="url(#hm-grad)" d="M427.64,1.69l-202.38,139.41c-.32.25-.66.46-1,.66-.1.06-.2.11-.3.16-.32.16-.64.32-.97.43-.02,0-.03,0-.05.02-.37.13-.75.22-1.13.29-.03,0-.06.01-.1.02-.39.06-.79.1-1.18.1-1.65,0-3.3-.56-4.74-1.67L13.42,1.69C7.64-2.79,0,2.16,0,10.37v421.58c0,5.72,3.89,10.35,8.68,10.35h168.33c5.21,0,9.82-3.37,11.4-8.33.98-3.06,2.13-6.89,3.34-11.35.39-1.44.79-2.95,1.18-4.52.2-.78.4-1.58.6-2.4.4-1.63.8-3.32,1.19-5.07.39-1.75.78-3.55,1.16-5.4.76-3.71,1.49-7.62,2.15-11.7.17-1.02.33-2.05.48-3.09.78-5.21,1.45-10.67,1.94-16.32.1-1.13.19-2.27.27-3.41,2.09-28.61-.6-61.56-15.95-90.46-2.45-4.62-5.23-9.14-8.37-13.53,0,0,27.23,16.74,44.08,54.11,16.85-37.37,44.08-54.11,44.08-54.11-41.71,58.29-20.37,141.01-11.99,167.25,1.58,4.96,6.19,8.32,11.4,8.32h168.37c4.8,0,8.68-4.64,8.68-10.35V10.37c0-8.22-7.64-13.16-13.42-8.68ZM278.05,203.52c8.68-1.11,17.68,2.48,23.07,10.14,5.39,7.65,5.76,17.33,1.79,25.14-8.68,1.11-17.68-2.48-23.07-10.14-5.39-7.65-5.76-17.33-1.79-25.14ZM257.86,182.83c6.09,2.37,10.04,7.85,10.75,13.92-4.62,4-11.24,5.38-17.33,3.02-6.09-2.37-10.04-7.85-10.75-13.92,4.62-4,11.24-5.38,17.33-3.02ZM220.5,174.69c5.02-.02,9.39,2.79,11.6,6.93-2.18,4.16-6.52,7.01-11.54,7.03-5.02.02-9.39-2.79-11.6-6.93,2.18-4.16,6.52-7.01,11.54-7.03ZM138.43,222.92c9.47-3.52,20.53-1.82,28.59,5.38,8.06,7.2,11,17.99,8.57,27.8-9.47,3.52-20.53,1.82-28.59-5.38-8.06-7.2-11-17.99-8.57-27.8ZM123.74,265.47c1.15-6.91,6.46-12.19,13.3-14.15,5.83,4.07,9.15,10.79,8,17.7-1.15,6.91-6.46,12.19-13.3,14.15-5.83-4.07-9.15-10.79-8-17.7ZM191.82,358.95c-8.69,3.37-18.99,1.94-26.68-4.63-7.69-6.56-10.72-16.52-8.74-25.63,8.69-3.37,18.99-1.94,26.68,4.63,7.69,6.56,10.72,16.52,8.74,25.63ZM182.94,308.24c-7.36,8.49-19.08,12.74-30.85,10.05-11.77-2.69-20.47-11.62-23.41-22.47,7.36-8.49,19.08-12.74,30.85-10.05,11.77,2.69,20.47,11.62,23.41,22.47ZM161.78,216.36c-1.43-10.47,2.82-21.36,12.01-27.94,9.18-6.59,20.86-7.12,30.32-2.41,1.43,10.47-2.82,21.36-12.01,27.94-9.18-6.59-20.86-7.12-30.32-2.41ZM186.67,236.75c2.82-12.73,12.45-22.19,24.21-25.42,9.29,7.9,14.02,20.54,11.2,33.27-2.82,12.73-12.45,22.19-24.21,25.42-9.29-7.9-14.02-20.54-11.2-33.27ZM231.53,285.81c-6.01,5.93-14.57,7.68-22.1,5.3-2.27-7.56-.4-16.09,5.62-22.02,6.01-5.93,14.57-7.68,22.1-5.3,2.27,7.56.4,16.09-5.62,22.02ZM239.57,247.8c-9.19-10.21-11.41-24.25-6.98-36.31,12.46-3.13,26.19.54,35.38,10.75,9.19,10.21,11.41,24.25,6.98,36.31-12.46,3.13-26.19-.54-35.38-10.75ZM279.72,349.22c-6.01,9.4-16.53,14.17-26.93,13.31-5.14-9.08-5.23-20.62.78-30.03,6.01-9.4,16.53-14.17,26.93-13.31,5.14,9.08,5.23,20.62-.78,30.03ZM262.83,307.05c-4.37-8.89-3.82-19.83,2.39-28.41,6.21-8.58,16.44-12.52,26.25-11.13,4.37,8.89,3.82,19.83-2.39,28.41-6.21,8.58-16.44,12.52-26.25,11.13ZM310.84,313.15c-3.42,7.3-10.51,11.71-18.04,12.07-4.54-6.02-5.69-14.28-2.27-21.58,3.42-7.3,10.51-11.71,18.04-12.07,4.54,6.02,5.69,14.28,2.27,21.58ZM309.95,281.38c-6.91-3.09-11.94-9.79-12.48-17.87-.54-8.08,3.55-15.39,9.99-19.37,6.91,3.09,11.94,9.79,12.48,17.87.54,8.08-3.55,15.39-9.99,19.37Z"/>
        </svg>
        <span class="header-wordmark">Morechard <span class="badge">ADMIN</span></span>
      </div>
      <button class="sign-out" id="sign-out-btn">Sign out</button>
    </div>
  </header>
  <nav>
    <div class="nav-inner">
      <button class="active" data-tab="rates">Exchange Rates</button>
      <button data-tab="promos">Promo Codes</button>
      <button data-tab="candidates">Chore Candidates</button>
      <button data-tab="agent-review">Agent Review</button>
    </div>
  </nav>
  <main>
  <div class="content-inner">

    <!-- Exchange Rates -->
    <div id="tab-rates" class="tab-panel active">
      <div class="card">
        <h2>Locale Multipliers</h2>
        <p class="desc">PPP-adjusted price multipliers relative to GBP pence. Changing a value busts the market-rates cache immediately.</p>
        <table>
          <thead><tr><th>Locale</th><th>Currency</th><th>Multiplier</th><th>Label</th><th>Last updated</th><th></th></tr></thead>
          <tbody id="rates-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Promo Codes -->
    <div id="tab-promos" class="tab-panel">
      <div class="card">
        <h2>Promo Codes <button class="info-btn" id="promos-info-btn" title="How do promo codes work?">?</button></h2>
        <p class="desc">Stripe promo codes issued to schools. Each code is shared by all families at that school.</p>
        <table>
          <thead><tr><th>Code</th><th>Label</th><th>Coupon</th><th>Redemptions</th><th>Max</th><th>Created</th></tr></thead>
          <tbody id="promos-body"></tbody>
        </table>
      </div>
      <div class="card">
        <h2>Create promo code</h2>
        <p class="desc">Creates the code in Stripe and records it here. The Stripe Coupon must exist first.</p>
        <div class="form-grid">
          <div><label for="pc-coupon">Stripe Coupon ID</label><input type="text" id="pc-coupon" placeholder="e.g. SCHOOL50OFF"></div>
          <div><label for="pc-label">Display label</label><input type="text" id="pc-label" placeholder="e.g. Springfield Primary 2025"></div>
          <div><label for="pc-code">Code (shown to families)</label><input type="text" id="pc-code" placeholder="e.g. SPRINGFIELD2025"></div>
          <div><label for="pc-max">Max redemptions</label><input type="number" id="pc-max" placeholder="100" min="1" max="10000"></div>
        </div>
        <button class="btn-primary mt" id="create-promo-btn">Create code</button>
      </div>
    </div>

    <!-- Candidates -->
    <div id="tab-candidates" class="tab-panel">
      <div class="filter-bar" style="align-items:center">
        <button class="btn-ghost btn-sm active" data-status="pending">Pending</button>
        <button class="btn-ghost btn-sm" data-status="promoted">Promoted</button>
        <button class="btn-ghost btn-sm" data-status="dismissed">Dismissed</button>
        <button class="info-btn" id="candidates-info-btn" title="What is this?">?</button>
      </div>
      <div id="candidates-list"></div>
    </div>

    <!-- Agent Review -->
    <div id="tab-agent-review" class="tab-panel">
      <div class="card">
        <h2>Agent Review Queue</h2>
        <p class="desc">Every incident the support agent diagnosed. Approve executes the recommended tool immediately — no customer message is ever sent automatically.</p>
        <div class="filter-bar">
          <button class="btn-ghost btn-sm active" data-review-status="pending">Pending</button>
          <button class="btn-ghost btn-sm" data-review-status="declined">Declined</button>
          <button class="btn-ghost btn-sm" data-review-status="executed">Executed</button>
        </div>
        <div class="filter-bar" id="review-refine-bar" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div class="field">
            <label for="review-filter-category">Category</label>
            <select id="review-filter-category"><option value="">All</option></select>
          </div>
          <div class="field">
            <label for="review-filter-source">Source</label>
            <select id="review-filter-source"><option value="">All</option></select>
          </div>
          <div class="field">
            <label for="review-filter-bucket">Recommendation</label>
            <select id="review-filter-bucket">
              <option value="">All</option>
              <option value="recommended_approve">Recommended: Approve</option>
              <option value="needs_review">Needs Review</option>
            </select>
          </div>
          <div class="field">
            <label for="review-filter-confidence">Min confidence</label>
            <select id="review-filter-confidence">
              <option value="0">Any</option>
              <option value="0.5">50%+</option>
              <option value="0.75">75%+</option>
              <option value="0.9">90%+</option>
            </select>
          </div>
          <div class="field">
            <label for="review-sort">Sort</label>
            <select id="review-sort">
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="confidence_desc">Confidence: high to low</option>
              <option value="confidence_asc">Confidence: low to high</option>
            </select>
          </div>
        </div>
        <div id="agent-review-list"></div>
      </div>
    </div>

  </div><!-- /.content-inner -->
  </main>
</div>

<div id="toast"></div>

<!-- Promo codes explainer modal -->
<div class="modal-overlay" id="promos-modal">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="promos-modal-title">
    <button class="modal-close" id="promos-modal-close" aria-label="Close">&#x2715;</button>
    <h3 id="promos-modal-title">Promo Codes — how it works</h3>
    <p>Promo codes give schools (or any group) a discount at the Stripe checkout. A parent types the code when buying and the discount is applied automatically. All families at a school share one code — you set a cap on how many times it can be used.</p>
    <div class="modal-section">
      <h4>Step 1 — create a coupon in Stripe first</h4>
      <p>A <strong>coupon</strong> defines the actual discount — e.g. 50% off, or £20 off. Go to your Stripe dashboard → Products → Coupons and create one. Copy the Coupon ID (e.g. <strong>SCHOOL50OFF</strong>) — you'll need it here.</p>
    </div>
    <div class="modal-section">
      <h4>Step 2 — create the promo code here</h4>
      <p><strong>Stripe Coupon ID</strong> — the ID from Step 1. Links the code to the discount.</p>
      <p><strong>Display label</strong> — your internal note (e.g. <em>Springfield Primary 2025</em>). Families never see this — it's just so you can tell codes apart in this list.</p>
      <p><strong>Code</strong> — what the parent types at checkout (e.g. <em>SPRINGFIELD2025</em>). Put this in the school newsletter.</p>
      <p><strong>Max redemptions</strong> — how many families can use it before Stripe stops accepting it. Set it to roughly the number of families at the school.</p>
    </div>
    <div class="modal-section">
      <h4>Tracking redemptions</h4>
      <p>The table above shows a live redemption count per code. Once a code hits its limit, Stripe rejects it automatically — you don't need to do anything.</p>
    </div>
  </div>
</div>

<!-- Candidates explainer modal -->
<div class="modal-overlay" id="candidates-modal">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <button class="modal-close" id="candidates-modal-close" aria-label="Close">&#x2715;</button>
    <h3 id="modal-title">Chore Candidates — how it works</h3>
    <p>When a child browses the Rate Guide and types in a chore that doesn't exist in the library yet, it gets submitted as a <strong>suggestion</strong>. These suggestions are aggregated weekly — once the same chore has been suggested by enough different families, it surfaces here as a candidate ready for your review.</p>
    <div class="modal-section">
      <h4>The three statuses</h4>
      <p><strong>Pending</strong> — suggested by children, not yet reviewed. Shows the chore name, category, how many different families suggested it, and the median amount they proposed paying.</p>
      <p><strong>Promote</strong> — you approve it and it's added to the main Rate Guide library permanently. Every family in every locale then sees it as a suggested chore going forward.</p>
      <p><strong>Dismiss</strong> — you reject it (e.g. it's a duplicate, inappropriate, or too niche). It's flagged so the weekly job never resurfaces it.</p>
    </div>
    <div class="modal-section">
      <h4>When to check this</h4>
      <p>Occasionally — once a month is plenty. The Rate Guide ships with ~30 built-in chores. Children grow it organically through use; this tab is your quality gate before anything goes public.</p>
    </div>
  </div>
</div>

<script>
(function () {
  'use strict';

  /* ── State ────────────────────────────────────────────────────────────── */
  var adminKey = sessionStorage.getItem('morechard_admin_key') || '';
  var candidateStatus = 'pending';
  var reviewStatus = 'pending';

  // Data stores — keyed by locale / id so onclick handlers never embed data in HTML
  var ratesStore = {};      // locale -> rate object
  var candidatesStore = {}; // id -> candidate object

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, {
      'X-Admin-Key': adminKey,
      'Content-Type': 'application/json',
    });
    return fetch(path, opts);
  }

  function setText(el, value) {
    el.textContent = value == null ? '' : String(value);
  }

  function td(value, className) {
    var cell = document.createElement('td');
    setText(cell, value);
    if (className) cell.className = className;
    return cell;
  }

  function btn(label, classes, handler) {
    var b = document.createElement('button');
    b.textContent = label;
    b.className = classes;
    b.addEventListener('click', handler);
    return b;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  var toastTimer;
  function toast(msg, type) {
    var el = document.getElementById('toast');
    setText(el, msg);
    el.className = type === 'err' ? 'err' : 'ok';
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, 3500);
  }

  function setLoading(tbodyId) {
    var tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty';
    var spinner = document.createElement('span');
    spinner.className = 'spinner';
    cell.appendChild(spinner);
    tr.appendChild(cell);
    tbody.appendChild(tr);
  }

  function setEmpty(containerId, message, colspan) {
    var container = document.getElementById(containerId);
    var isTable = container.tagName === 'TBODY';
    if (isTable) {
      container.innerHTML = '';
      var tr = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = colspan || 6;
      cell.className = 'empty';
      setText(cell, message);
      tr.appendChild(cell);
      container.appendChild(tr);
    } else {
      container.innerHTML = '';
      var div = document.createElement('div');
      div.className = 'empty';
      setText(div, message);
      container.appendChild(div);
    }
  }

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('key-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('sign-out-btn').addEventListener('click', signOut);

  function doLogin() {
    var k = document.getElementById('key-input').value.trim();
    if (!k) return;
    adminKey = k;
    apiFetch('/api/admin/exchange-rates').then(function (res) {
      if (res.ok) {
        sessionStorage.setItem('morechard_admin_key', adminKey);
        showApp();
      } else {
        showLoginErr('Invalid admin key');
      }
    }).catch(function () { showLoginErr('Could not reach server'); });
  }

  function showLoginErr(msg) {
    var el = document.getElementById('login-err');
    setText(el, msg);
    el.style.display = 'block';
  }

  function signOut() {
    sessionStorage.removeItem('morechard_admin_key');
    adminKey = '';
    document.getElementById('app').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
    document.getElementById('key-input').value = '';
  }

  function showApp() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    loadRates();
    loadPromos();
    loadCandidates();
    loadAgentReviewItems();
  }

  if (adminKey) showApp();

  /* ── Tabs ─────────────────────────────────────────────────────────────── */
  document.querySelectorAll('.nav-inner button[data-tab]').forEach(function (navBtn) {
    navBtn.addEventListener('click', function () {
      document.querySelectorAll('.nav-inner button').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      navBtn.classList.add('active');
      document.getElementById('tab-' + navBtn.dataset.tab).classList.add('active');
    });
  });

  /* ── Exchange Rates ───────────────────────────────────────────────────── */
  function loadRates() {
    setLoading('rates-body');
    apiFetch('/api/admin/exchange-rates')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tbody = document.getElementById('rates-body');
        tbody.innerHTML = '';
        var rates = data.rates || [];
        if (!rates.length) { setEmpty('rates-body', 'No rates found'); return; }

        rates.forEach(function (rate) {
          ratesStore[rate.locale] = rate;

          // Main row
          var tr = document.createElement('tr');
          tr.appendChild(td(rate.locale, 'mono'));
          tr.appendChild(td(rate.currency));
          var multTd = td('');
          var strong = document.createElement('strong');
          setText(strong, rate.multiplier);
          multTd.appendChild(strong);
          tr.appendChild(multTd);
          tr.appendChild(td(rate.label));
          tr.appendChild(td(fmtDate(rate.updated_at), 'muted'));
          var actionTd = document.createElement('td');
          actionTd.appendChild(btn('Edit', 'btn-ghost btn-sm', function () { toggleEdit(rate.locale); }));
          tr.appendChild(actionTd);
          tbody.appendChild(tr);

          // Edit row
          var editTr = document.createElement('tr');
          editTr.id = 'edit-row-' + rate.locale;
          editTr.className = 'edit-row';
          var editTd = document.createElement('td');
          editTd.colSpan = 6;

          var form = document.createElement('div');
          form.className = 'edit-form';

          var multField = document.createElement('div');
          multField.className = 'field';
          var multLabel = document.createElement('label');
          multLabel.textContent = 'Multiplier';
          var multInput = document.createElement('input');
          multInput.type = 'number';
          multInput.step = '0.01';
          multInput.min = '0.01';
          multInput.id = 'em-mult-' + rate.locale;
          multInput.value = String(rate.multiplier);
          multField.appendChild(multLabel);
          multField.appendChild(multInput);

          var labelField = document.createElement('div');
          labelField.className = 'field';
          var labelLabel = document.createElement('label');
          labelLabel.textContent = 'Label';
          var labelInput = document.createElement('input');
          labelInput.type = 'text';
          labelInput.id = 'em-label-' + rate.locale;
          labelInput.value = rate.label;
          labelField.appendChild(labelLabel);
          labelField.appendChild(labelInput);

          var actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:8px;margin-top:20px';
          var locale = rate.locale; // capture for closure
          actions.appendChild(btn('Save', 'btn-primary btn-sm', function () { saveRate(locale); }));
          actions.appendChild(btn('Cancel', 'btn-ghost btn-sm', function () { toggleEdit(locale); }));

          form.appendChild(multField);
          form.appendChild(labelField);
          form.appendChild(actions);
          editTd.appendChild(form);
          editTr.appendChild(editTd);
          tbody.appendChild(editTr);
        });
      })
      .catch(function () { setEmpty('rates-body', 'Failed to load'); });
  }

  function toggleEdit(locale) {
    var row = document.getElementById('edit-row-' + locale);
    if (row) row.classList.toggle('open');
  }

  function saveRate(locale) {
    var multEl  = document.getElementById('em-mult-' + locale);
    var labelEl = document.getElementById('em-label-' + locale);
    var mult = parseFloat(multEl.value);
    var label = labelEl.value.trim();
    if (!mult || mult <= 0) { toast('Multiplier must be a positive number', 'err'); return; }
    var body = { multiplier: mult };
    if (label) body.label = label;
    apiFetch('/api/admin/exchange-rates/' + encodeURIComponent(locale), { method: 'PUT', body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { toast('Multiplier updated — cache busted', 'ok'); loadRates(); }
        else toast((res.d && res.d.error) || 'Save failed', 'err');
      })
      .catch(function () { toast('Network error', 'err'); });
  }

  /* ── Promo Codes ──────────────────────────────────────────────────────── */
  function loadPromos() {
    setLoading('promos-body');
    apiFetch('/api/admin/promo-codes')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tbody = document.getElementById('promos-body');
        tbody.innerHTML = '';
        var codes = data.codes || [];
        if (!codes.length) { setEmpty('promos-body', 'No promo codes yet'); return; }
        codes.forEach(function (c) {
          var tr = document.createElement('tr');
          tr.appendChild(td(c.code, 'mono'));
          tr.appendChild(td(c.label));
          tr.appendChild(td(c.coupon_id, 'mono muted'));
          tr.appendChild(td(c.redemptions));
          tr.appendChild(td(c.max_redemptions));
          tr.appendChild(td(fmtDate(c.created_at), 'muted'));
          tbody.appendChild(tr);
        });
      })
      .catch(function () { setEmpty('promos-body', 'Failed to load'); });
  }

  document.getElementById('create-promo-btn').addEventListener('click', function () {
    var coupon = document.getElementById('pc-coupon').value.trim();
    var label  = document.getElementById('pc-label').value.trim();
    var code   = document.getElementById('pc-code').value.trim().toUpperCase();
    var max    = parseInt(document.getElementById('pc-max').value, 10);
    if (!coupon || !label || !code || !max) { toast('All fields are required', 'err'); return; }
    apiFetch('/api/admin/promo-codes', { method: 'POST', body: JSON.stringify({ coupon_id: coupon, label: label, code: code, max_redemptions: max }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          toast('Code ' + res.d.code + ' created', 'ok');
          loadPromos();
          ['pc-coupon', 'pc-label', 'pc-code', 'pc-max'].forEach(function (id) { document.getElementById(id).value = ''; });
        } else {
          toast((res.d && res.d.error) || 'Create failed', 'err');
        }
      })
      .catch(function () { toast('Network error', 'err'); });
  });

  /* ── Candidates ───────────────────────────────────────────────────────── */
  /* ── Modals (shared open/close logic) ───────────────────────────────── */
  function setupModal(modalId, triggerBtnId, closeBtnId) {
    var modal = document.getElementById(modalId);
    function open() { modal.classList.add('open'); }
    function close() { modal.classList.remove('open'); }
    document.getElementById(triggerBtnId).addEventListener('click', open);
    document.getElementById(closeBtnId).addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  setupModal('promos-modal',     'promos-info-btn',     'promos-modal-close');
  setupModal('candidates-modal', 'candidates-info-btn', 'candidates-modal-close');

  /* ── Candidates ───────────────────────────────────────────────────────── */
  document.querySelectorAll('.filter-bar button[data-status]').forEach(function (filterBtn) {
    filterBtn.addEventListener('click', function () {
      document.querySelectorAll('.filter-bar button').forEach(function (b) { b.classList.remove('active'); });
      filterBtn.classList.add('active');
      candidateStatus = filterBtn.dataset.status;
      loadCandidates();
    });
  });

  function loadCandidates() {
    var list = document.getElementById('candidates-list');
    list.innerHTML = '';
    var spinner = document.createElement('div');
    spinner.className = 'empty';
    spinner.appendChild(document.createElement('span')).className = 'spinner';
    list.appendChild(spinner);

    apiFetch('/api/admin/promotion-candidates?status=' + encodeURIComponent(candidateStatus))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        list.innerHTML = '';
        var items = data.candidates || [];
        if (!items.length) {
          var empty = document.createElement('div');
          empty.className = 'empty';
          setText(empty, 'No ' + candidateStatus + ' candidates');
          list.appendChild(empty);
          return;
        }

        items.forEach(function (c) {
          candidatesStore[c.id] = c;

          var card = document.createElement('div');
          card.className = 'candidate';

          var info = document.createElement('div');
          info.className = 'candidate-info';

          var h3 = document.createElement('h3');
          setText(h3, c.display_name || c.normalized_key);
          info.appendChild(h3);

          var meta = document.createElement('div');
          meta.className = 'meta';
          var metaParts = [
            c.category || '—',
            (c.distinct_families || 0) + (c.distinct_families === 1 ? ' family' : ' families'),
            'locale: ' + (c.locale || '—'),
          ];
          if (c.median_amount != null) metaParts.push('median: ' + c.median_amount);
          setText(meta, metaParts.join(' · '));
          info.appendChild(meta);

          var actionsEl = document.createElement('div');
          actionsEl.className = 'candidate-actions';

          if (candidateStatus === 'pending') {
            var cId = c.id;
            actionsEl.appendChild(btn('Promote', 'btn-primary btn-sm', function () { promoteCandidate(cId); }));
            actionsEl.appendChild(btn('Dismiss', 'btn-danger btn-sm', function () { dismissCandidate(cId); }));
          } else {
            var pill = document.createElement('span');
            pill.className = 'pill ' + (candidateStatus === 'promoted' ? 'pill-teal' : 'pill-gray');
            setText(pill, candidateStatus);
            actionsEl.appendChild(pill);
          }

          card.appendChild(info);
          card.appendChild(actionsEl);
          list.appendChild(card);
        });
      })
      .catch(function () {
        list.innerHTML = '';
        var err = document.createElement('div');
        err.className = 'empty';
        setText(err, 'Failed to load');
        list.appendChild(err);
      });
  }

  function promoteCandidate(id) {
    apiFetch('/api/admin/promotion-candidates/' + encodeURIComponent(id) + '/promote', { method: 'POST', body: '{}' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { toast('Promoted to market rates library', 'ok'); loadCandidates(); }
        else toast((res.d && res.d.error) || 'Promote failed', 'err');
      })
      .catch(function () { toast('Network error', 'err'); });
  }

  function dismissCandidate(id) {
    apiFetch('/api/admin/promotion-candidates/' + encodeURIComponent(id) + '/dismiss', { method: 'POST', body: '{}' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { toast('Dismissed', 'ok'); loadCandidates(); }
        else toast((res.d && res.d.error) || 'Dismiss failed', 'err');
      })
      .catch(function () { toast('Network error', 'err'); });
  }

  /* ── Agent Review ─────────────────────────────────────────────────────── */
  var reviewItemsStore = []; // raw items for the current status, before filtering/sorting

  document.querySelectorAll('button[data-review-status]').forEach(function (filterBtn) {
    filterBtn.addEventListener('click', function () {
      document.querySelectorAll('button[data-review-status]').forEach(function (b) { b.classList.remove('active'); });
      filterBtn.classList.add('active');
      reviewStatus = filterBtn.dataset.reviewStatus;
      loadAgentReviewItems();
    });
  });

  ['review-filter-category', 'review-filter-source', 'review-filter-bucket', 'review-filter-confidence', 'review-sort'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', renderFilteredReviewItems);
  });

  function loadAgentReviewItems() {
    var list = document.getElementById('agent-review-list');
    list.innerHTML = '';
    var spinner = document.createElement('div');
    spinner.className = 'empty';
    spinner.appendChild(document.createElement('span')).className = 'spinner';
    list.appendChild(spinner);

    apiFetch('/api/admin/agent-review?status=' + encodeURIComponent(reviewStatus))
      .then(function (r) {
        if (!r.ok) throw new Error('bad response');
        return r.json();
      })
      .then(function (data) {
        reviewItemsStore = data.items || [];
        populateReviewFilterOptions(reviewItemsStore);
        renderFilteredReviewItems();
      })
      .catch(function () {
        reviewItemsStore = [];
        setEmpty('agent-review-list', 'Failed to load review items');
      });
  }

  function populateReviewFilterOptions(items) {
    fillSelectOptions('review-filter-category', uniqueSorted(items.map(function (i) { return i.category; })));
    fillSelectOptions('review-filter-source', uniqueSorted(items.map(function (i) { return i.source; })));
  }

  function fillSelectOptions(selectId, values) {
    var select = document.getElementById(selectId);
    var current = select.value;
    select.innerHTML = '';
    var allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All';
    select.appendChild(allOpt);
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    if (values.indexOf(current) !== -1) select.value = current;
  }

  function uniqueSorted(values) {
    var seen = {};
    var out = [];
    values.forEach(function (v) {
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    out.sort();
    return out;
  }

  function renderFilteredReviewItems() {
    var list = document.getElementById('agent-review-list');
    var category   = document.getElementById('review-filter-category').value;
    var source     = document.getElementById('review-filter-source').value;
    var bucket     = document.getElementById('review-filter-bucket').value;
    var minConf    = parseFloat(document.getElementById('review-filter-confidence').value) || 0;
    var sortMode   = document.getElementById('review-sort').value;

    var items = reviewItemsStore.filter(function (i) {
      if (category && i.category !== category) return false;
      if (source && i.source !== source) return false;
      if (bucket && i.queue_bucket !== bucket) return false;
      if ((i.confidence || 0) < minConf) return false;
      return true;
    });

    items.sort(function (a, b) {
      if (sortMode === 'created_asc') return a.created_at - b.created_at;
      if (sortMode === 'confidence_desc') return (b.confidence || 0) - (a.confidence || 0);
      if (sortMode === 'confidence_asc') return (a.confidence || 0) - (b.confidence || 0);
      return b.created_at - a.created_at; // created_desc (default)
    });

    list.innerHTML = '';
    if (!items.length) {
      setEmpty('agent-review-list', reviewItemsStore.length ? 'No items match the selected filters' : 'No ' + reviewStatus + ' items');
      return;
    }
    items.forEach(function (item) { list.appendChild(renderReviewItemCard(item)); });
  }

  /* Lightweight markdown -> DOM renderer for LLM-drafted reply text
     (paragraphs, blank-line-separated numbered/bulleted lists, **bold**).
     Builds elements via createElement/textContent only — never innerHTML
     from the draft text — so it stays safe even though the text originates
     from an LLM response to a potentially attacker-influenced support ticket. */
  function parseReplyBlocks(text) {
    var lines = String(text).replace(/\\r\\n/g, '\\n').split('\\n');
    var blocks = [];
    var current = null;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) { current = null; return; }
      var bulletMatch = /^[-*]\\s+(.*)$/.exec(trimmed);
      var numMatch = /^\\d+\\.\\s+(.*)$/.exec(trimmed);
      if (bulletMatch) {
        if (!current || current.type !== 'ul') { current = { type: 'ul', items: [] }; blocks.push(current); }
        current.items.push(bulletMatch[1]);
      } else if (numMatch) {
        if (!current || current.type !== 'ol') { current = { type: 'ol', items: [] }; blocks.push(current); }
        current.items.push(numMatch[1]);
      } else {
        if (!current || current.type !== 'p') { current = { type: 'p', items: [] }; blocks.push(current); }
        current.items.push(trimmed);
      }
    });
    return blocks;
  }

  function appendInlineMarkdown(parentEl, text) {
    var re = /\\*\\*(.+?)\\*\\*/g;
    var lastIndex = 0;
    var match;
    while ((match = re.exec(text))) {
      if (match.index > lastIndex) parentEl.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      var strong = document.createElement('strong');
      strong.textContent = match[1];
      parentEl.appendChild(strong);
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) parentEl.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  function renderFormattedReply(container, text) {
    container.innerHTML = '';
    parseReplyBlocks(text).forEach(function (block) {
      if (block.type === 'p') {
        var p = document.createElement('p');
        block.items.forEach(function (line, idx) {
          if (idx > 0) p.appendChild(document.createElement('br'));
          appendInlineMarkdown(p, line);
        });
        container.appendChild(p);
      } else {
        var listEl = document.createElement(block.type);
        block.items.forEach(function (itemText) {
          var li = document.createElement('li');
          appendInlineMarkdown(li, itemText);
          listEl.appendChild(li);
        });
        container.appendChild(listEl);
      }
    });
  }

  function copyDraftReplyHtml(bodyEl, plainText) {
    var html = bodyEl.innerHTML; // built entirely via createElement/textContent above — safe to read back
    if (navigator.clipboard && window.ClipboardItem) {
      var item = new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      navigator.clipboard.write([item]).then(function () {
        toast('Copied formatted reply to clipboard', 'ok');
      }).catch(function () {
        copyDraftReplyPlain(plainText);
      });
    } else {
      copyDraftReplyPlain(plainText);
    }
  }

  function copyDraftReplyPlain(plainText) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(plainText).then(function () {
        toast('Copied reply (plain text) to clipboard', 'ok');
      }).catch(function () {
        toast('Copy failed — select and copy manually', 'err');
      });
    } else {
      toast('Copy not supported in this browser', 'err');
    }
  }

  function renderReviewItemCard(item) {
    var card = document.createElement('div');
    card.className = 'review-card';

    var badge = document.createElement('span');
    badge.className = 'review-badge ' + (item.queue_bucket === 'recommended_approve' ? 'badge-approve' : 'badge-review');
    setText(badge, item.queue_bucket === 'recommended_approve' ? 'Recommended: Approve' : 'Needs Review');
    card.appendChild(badge);

    if (item.source) {
      var sourcePill = document.createElement('span');
      sourcePill.className = 'review-source';
      setText(sourcePill, item.source.replace(/_/g, ' '));
      card.appendChild(sourcePill);
    }

    var category = document.createElement('div');
    category.className = 'review-category';
    setText(category, 'Category: ' + (item.category || 'unknown') + ' — confidence ' + Math.round((item.confidence || 0) * 100) + '%' + ' — ' + fmtDateTime(item.created_at));
    card.appendChild(category);

    var diagnosis = document.createElement('pre');
    diagnosis.className = 'review-diagnosis';
    setText(diagnosis, item.diagnosis);
    card.appendChild(diagnosis);

    if (item.recommended_tool) {
      var tool = document.createElement('div');
      tool.className = 'review-tool';
      setText(tool, 'Recommended tool: ' + item.recommended_tool + ' (' + item.recommended_tier + ')');
      card.appendChild(tool);
    }

    if (item.draft_reply) {
      var draft = document.createElement('div');
      draft.className = 'review-draft';

      var draftHeader = document.createElement('div');
      draftHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px';
      var label = document.createElement('strong');
      label.textContent = 'Draft reply (not sent):';
      draftHeader.appendChild(label);
      var draftReplyText = item.draft_reply;
      draftHeader.appendChild(btn('Copy HTML', 'btn-ghost btn-sm', function () { copyDraftReplyHtml(body, draftReplyText); }));
      draft.appendChild(draftHeader);

      var body = document.createElement('div');
      body.className = 'review-draft-body';
      renderFormattedReply(body, item.draft_reply);
      draft.appendChild(body);

      card.appendChild(draft);
    }

    var itemId = item.id; // capture for closure

    if (item.status === 'pending') {
      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;margin-top:12px';
      if (item.recommended_tier === 'auto' && item.recommended_tool && item.recommended_payload) {
        actions.appendChild(btn('Approve', 'btn-primary btn-sm', function () { approveReviewItem(itemId); }));
      }
      actions.appendChild(btn('Decline (bad diagnosis)', 'btn-ghost btn-sm', function () { declineReviewItem(itemId); }));
      card.appendChild(actions);
    } else {
      var decision = document.createElement('div');
      decision.className = 'review-category';
      var decisionParts = [
        (item.status === 'executed' ? 'Executed' : 'Declined') + ' by ' + (item.decided_by || 'unknown'),
        fmtDateTime(item.decided_at),
      ];
      setText(decision, decisionParts.join(' — '));
      card.appendChild(decision);
      if (item.decision_note) {
        var noteEl = document.createElement('div');
        noteEl.className = 'review-draft';
        setText(noteEl, item.decision_note);
        card.appendChild(noteEl);
      }
    }

    return card;
  }

  function approveReviewItem(id) {
    if (!confirm('Execute the recommended tool now? This cannot be undone.')) return;
    apiFetch('/api/admin/agent-review/' + encodeURIComponent(id) + '/approve', { method: 'POST', body: '{}' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { toast('Approved and executed', 'ok'); loadAgentReviewItems(); }
        else toast((res.d && res.d.error) || 'Approve failed', 'err');
      })
      .catch(function () { toast('Network error', 'err'); });
  }

  function declineReviewItem(id) {
    var note = prompt('Why was this diagnosis wrong? (feeds playbook tuning)');
    if (!note) return;
    apiFetch('/api/admin/agent-review/' + encodeURIComponent(id) + '/decline', { method: 'POST', body: JSON.stringify({ note: note }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { toast('Declined', 'ok'); loadAgentReviewItems(); }
        else toast((res.d && res.d.error) || 'Decline failed', 'err');
      })
      .catch(function () { toast('Network error', 'err'); });
  }

})();
</script>
</body>
</html>`;
}
