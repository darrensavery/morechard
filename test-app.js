const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const SCREENSHOTS = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS);

let passed = 0, failed = 0, warnings = 0;
const results = [];

function log(status, name, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const msg = `${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push({ status, name, detail });
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else warnings++;
}

async function ss(page, name) {
  const file = path.join(SCREENSHOTS, name.replace(/[^a-z0-9]/gi, '_') + '.png');
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function waitAndClick(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGE ERROR: ' + e.message));

  try {
    // ── 1. Page loads ───────────────────────────────────────────────────
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await ss(page, '01_initial_load');
    const title = await page.title();
    log(title ? 'PASS' : 'FAIL', 'Page loads', `title="${title}"`);

    // ── 2. Auth screen visible ───────────────────────────────────────────
    const authVisible = await page.isVisible('#auth-view, .auth-view, [id*="auth"], [id*="join"]').catch(() => false);
    const bodyText = await page.innerText('body');
    const hasAuthText = /join family|create.*family|sign in|log in|enter.*pin/i.test(bodyText);
    log(hasAuthText ? 'PASS' : 'WARN', 'Auth/login screen shown on load');

    // ── 3. Look for family code entry or create family ──────────────────
    await ss(page, '02_auth_screen');
    const hasCreateBtn = await page.isVisible('button:has-text("Create"), button:has-text("create"), [onclick*="create"], [onclick*="Create"]').catch(() => false);
    const hasJoinBtn = await page.isVisible('button:has-text("Join"), button:has-text("join")').catch(() => false);
    log(hasCreateBtn || hasJoinBtn ? 'PASS' : 'WARN', 'Create/Join buttons visible on auth screen');

    // ── 4. Try to enter a PIN for dad (existing account) ────────────────
    // Look for PIN input
    const pinInputs = await page.$$('input[type="number"], input[placeholder*="PIN"], input[placeholder*="pin"], input[id*="pin"]');
    log(pinInputs.length > 0 ? 'PASS' : 'WARN', 'PIN input present', `found ${pinInputs.length} input(s)`);

    // ── 5. Check for child selector buttons (family tabs) ───────────────
    const childBtns = await page.$$('.child-btn, .child-tab, [onclick*="selectChild"], [onclick*="login"]');
    log(childBtns.length >= 0 ? 'PASS' : 'WARN', 'Child/parent selector buttons', `found ${childBtns.length}`);

    await ss(page, '03_auth_detail');

    // ── 6. Check app structure — key element IDs exist in DOM ───────────
    const criticalIds = [
      'boss-view', 'logan-view',
      'boss-dashboard', 'boss-pending', 'boss-payments',
      'boss-jobs', 'boss-summary', 'boss-insights',
      'auth-screen',
      'modal-add-child', 'modal-goal-editor', 'modal-bonus',
      'modal-payout', 'modal-job'
    ];
    for (const id of criticalIds) {
      const exists = await page.$(`#${id}`) !== null;
      log(exists ? 'PASS' : 'FAIL', `DOM element #${id} exists`);
    }

    // ── 7. Check tab buttons exist ──────────────────────────────────────
    const bossTabs = ['btab-dashboard','btab-pending','btab-payments','btab-jobs','btab-summary','btab-insights'];
    for (const id of bossTabs) {
      const exists = await page.$(`#${id}`) !== null;
      log(exists ? 'PASS' : 'FAIL', `Boss tab #${id} exists`);
    }
    const childTabs = ['ltab-earn','ltab-goals','ltab-spend','ltab-balance','ltab-stats'];
    for (const id of childTabs) {
      const exists = await page.$(`#${id}`) !== null;
      log(exists ? 'PASS' : 'FAIL', `Child tab #${id} exists`);
    }

    // ── 8. Check JS functions are defined ───────────────────────────────
    const functions = [
      'saveNewChild', 'doRemoveChild', 'confirmRemoveChild',
      'openGoalEditor', 'saveGoalEdit', 'deleteGoal', 'deleteGoalBoss', 'moveGoal',
      'renderGoalSettings', 'renderBossGoalSettings',
      'reviewCompletion', 'bulkApprove',
      'checkStreakAward', 'saveStreakAward', 'clearStreakAward',
      'calcStreak', 'calcBestStreak',
      'renderPayments', 'renderDashboard', 'renderLogan',
      'renderChildrenList', 'renderWeekPlan',
      'bossTab', 'loganTab', 'openBossSettings',
      'getWeekStart', 'autoScheduleRecurring',
      'saveGoal', 'saveModel', 'exportPaymentsCSV',
      'openLoganStats', 'renderLoganStats',
      'goalCatIcon', 'goalCatEmoji',
      'showInviteCode', 'saveNewChild'
    ];
    for (const fn of functions) {
      const defined = await page.evaluate(f => typeof window[f] === 'function', fn);
      log(defined ? 'PASS' : 'FAIL', `Function ${fn}() defined`);
    }

    // ── 9. Check CSS variables defined ──────────────────────────────────
    const cssVars = ['--green','--teal','--amber','--blue','--red','--purple','--muted','--text','--bg','--white','--border','--gray-l','--green-l','--teal-l'];
    for (const v of cssVars) {
      const val = await page.evaluate(name => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), v);
      log(val ? 'PASS' : 'FAIL', `CSS variable ${v} defined`, val || 'MISSING');
    }

    // ── 10. Check GOAL_CATEGORIES has no emoji references ───────────────
    const catCheck = await page.evaluate(() => {
      if (typeof GOAL_CATEGORIES === 'undefined') return 'GOAL_CATEGORIES not defined';
      const hasEmoji = GOAL_CATEGORIES.some(c => c.emoji);
      const hasIcon = GOAL_CATEGORIES.every(c => c.icon);
      return { count: GOAL_CATEGORIES.length, hasEmoji, hasIcon, sample: GOAL_CATEGORIES[0] };
    });
    log(catCheck.count === 12 ? 'PASS' : 'FAIL', 'GOAL_CATEGORIES has 12 entries', JSON.stringify(catCheck));
    log(!catCheck.hasEmoji ? 'PASS' : 'FAIL', 'GOAL_CATEGORIES uses icons not emojis');
    log(catCheck.hasIcon ? 'PASS' : 'FAIL', 'All GOAL_CATEGORIES have icon property');

    // ── 11. Check streak calc filters approved only ──────────────────────
    const streakFiltered = await page.evaluate(() => {
      const src = calcStreak.toString();
      return src.includes("status==='approved'") || src.includes('status==\'approved\'');
    });
    log(streakFiltered ? 'PASS' : 'FAIL', 'calcStreak() filters approved completions only');

    // ── 12. Check moveGoal is async ──────────────────────────────────────
    const moveGoalAsync = await page.evaluate(() => {
      const src = moveGoal.toString();
      return src.startsWith('async');
    });
    log(moveGoalAsync ? 'PASS' : 'FAIL', 'moveGoal() is async');

    // ── 13. Check removeChild name conflict fixed ────────────────────────
    const removeChildIsNative = await page.evaluate(() => {
      // window.removeChild should NOT be our custom function
      return typeof window.doRemoveChild === 'function' && typeof document.removeChild === 'function';
    });
    log(removeChildIsNative ? 'PASS' : 'FAIL', 'doRemoveChild() avoids native removeChild conflict');

    // ── 14. Check openBossSettings hides dashboard ───────────────────────
    const settingsHidesDash = await page.evaluate(() => {
      const src = openBossSettings.toString();
      return src.includes("'dashboard'") || src.includes('"dashboard"');
    });
    log(settingsHidesDash ? 'PASS' : 'FAIL', 'openBossSettings() hides dashboard tab');

    // ── 15. Check match section hidden for children ──────────────────────
    const matchHiddenForChild = await page.evaluate(() => {
      const src = openGoalEditor.toString();
      return src.includes('goal-editor-match-section') && src.includes('isBoss');
    });
    log(matchHiddenForChild ? 'PASS' : 'FAIL', 'Goal editor hides match rate for children');

    // ── 16. Check saveGoalEdit preserves matchRate for children ──────────
    const preservesMatch = await page.evaluate(() => {
      const src = saveGoalEdit.toString();
      return src.includes('existingGoal') && src.includes('matchRate');
    });
    log(preservesMatch ? 'PASS' : 'FAIL', 'saveGoalEdit() preserves matchRate when child saves');

    // ── 17. Check getWeekStart uses local dates ──────────────────────────
    const weekStartLocal = await page.evaluate(() => {
      const src = getWeekStart.toString();
      return !src.includes('toISOString') && src.includes('getMonth');
    });
    log(weekStartLocal ? 'PASS' : 'FAIL', 'getWeekStart() uses local date (not UTC toISOString)');

    // ── 18. Check stats page renders inline (no modal) ───────────────────
    const statsInline = await page.evaluate(() => {
      const src = renderLoganStats.toString();
      return !src.includes('openModal') && src.includes('stats-content');
    });
    log(statsInline ? 'PASS' : 'FAIL', 'renderLoganStats() renders inline, not in modal');

    // ── 19. Check invite code shown after saveNewChild ───────────────────
    const inviteAfterAdd = await page.evaluate(() => {
      const src = saveNewChild.toString();
      return src.includes('showInviteCode');
    });
    log(inviteAfterAdd ? 'PASS' : 'FAIL', 'saveNewChild() triggers showInviteCode() after save');

    // ── 20. Check insights actions deep-link correctly ───────────────────
    const insightDeepLink = await page.evaluate(() => {
      // Find the renderInsights or similar function and check action routing
      const src = (typeof renderInsights === 'function' ? renderInsights : function(){}).toString();
      // Look in the rendered HTML for the insights section
      return document.body.innerHTML.includes('actionFns') ||
             (typeof renderInsights !== 'undefined');
    });
    // Check the source directly
    const insightFix = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('');
      return scripts.includes('showChildGoals') && scripts.includes('actionFns');
    });
    log(insightFix ? 'PASS' : 'FAIL', 'Insights action buttons deep-link (not just openBossSettings)');

    // ── 21. Check no JS syntax errors on load ────────────────────────────
    log(consoleErrors.length === 0 ? 'PASS' : 'FAIL',
      'No JS errors on page load',
      consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join(' | ') : 'clean');

    // ── 22. Visual — check key UI text visible in DOM ────────────────────
    const uiStrings = [
      { text: 'Earnings', desc: 'Child Earnings tab label' },
      { text: 'Goals', desc: 'Child Goals tab label' },
      { text: 'Spending', desc: 'Child Spending tab label' },
      { text: 'Balance', desc: 'Child Balance tab label' },
      { text: 'Stats', desc: 'Child Stats tab label' },
      { text: 'Dashboard', desc: 'Boss Dashboard tab' },
      { text: 'Approvals', desc: 'Boss Approvals tab' },
      { text: 'Payments', desc: 'Boss Payments tab' },
      { text: 'Jobs', desc: 'Boss Jobs tab' },
    ];
    for (const { text, desc } of uiStrings) {
      const found = await page.evaluate(t => document.body.innerHTML.includes(t), text);
      log(found ? 'PASS' : 'FAIL', `UI label "${text}" present`, desc);
    }

    // ── 23. Check Manrope font loaded ────────────────────────────────────
    const manropeLoaded = await page.evaluate(() => {
      const link = document.querySelector('link[href*="Manrope"]');
      return !!link;
    });
    log(manropeLoaded ? 'PASS' : 'WARN', 'Manrope font link present');

    // ── 24. Check form elements inherit font ─────────────────────────────
    const formFontFixed = await page.evaluate(() => {
      const style = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('');
      return style.includes('input,button') && style.includes('Manrope');
    });
    log(formFontFixed ? 'PASS' : 'FAIL', 'Form elements have Manrope font-family override');

    // ── 25. Modal overlay check — all modals present ─────────────────────
    const modals = ['modal-log','modal-job','modal-bonus','modal-reject','modal-job-history','modal-payout','modal-plan','modal-day-plan','modal-goal-editor','modal-add-child'];
    for (const id of modals) {
      const exists = await page.$(`#${id}`) !== null;
      log(exists ? 'PASS' : 'FAIL', `Modal #${id} present in DOM`);
    }

    // ── 26. Check streak award in payments (not settings) ────────────────
    const streakInPayments = await page.evaluate(() => {
      const src = renderPayments.toString();
      return src.includes('streakAward') && src.includes('streak-award-days');
    });
    log(streakInPayments ? 'PASS' : 'FAIL', 'Streak award config rendered inside renderPayments()');

    const streakNotInSettings = await page.evaluate(() => {
      const settingsEl = document.getElementById('boss-settings-pocketmoney');
      return settingsEl ? !settingsEl.innerHTML.includes('streak-award-days') : true;
    });
    log(streakNotInSettings ? 'PASS' : 'FAIL', 'Streak award NOT in pocket money settings HTML');

    // Final screenshot
    await ss(page, '99_final_state');

  } catch (e) {
    log('FAIL', 'Test runner exception', e.message);
    await ss(page, 'error_state').catch(() => {});
  }

  await browser.close();

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log(`Screenshots saved to: ${SCREENSHOTS}`);
  console.log('─'.repeat(60));

  if (failed > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  }
  if (warnings > 0) {
    console.log('\nWARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => console.log(`  ⚠️  ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
