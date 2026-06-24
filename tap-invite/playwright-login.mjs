/**
 * One-time login: opens a headed browser, waits for you to log in via magic link,
 * then saves the session to playwright-auth.json for reuse by the E2E script.
 *
 * Run: node playwright-login.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:4200';
const SESSION_FILE = 'playwright-auth.json';

const browser = await chromium.launch({ headless: false, slowMo: 0 });
const ctx = await browser.newContext();
const page = await ctx.newPage();

console.log('\n══════════════════════════════════════════════');
console.log('  Playwright Login — save session for E2E tests');
console.log('══════════════════════════════════════════════');
console.log('\nBrowser is opening at the login page.');
console.log('→ Enter your super admin email');
console.log('→ Click "Send Magic Link"');
console.log('→ Open the email and click the link');
console.log('→ Once you land on /admin, this script saves your session.\n');

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

console.log('Waiting for you to reach /admin (up to 5 minutes)...');

try {
  await page.waitForURL('**/admin', { timeout: 300000 });
  console.log('\n[OK] Landed on /admin — saving session...');

  const storageState = await ctx.storageState();
  writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));
  console.log(`[OK] Session saved to ${SESSION_FILE}`);
  console.log('\nYou can now run: node e2e-verify-steps5-8.mjs\n');
} catch {
  console.error('[ERROR] Timed out or navigation failed.');
}

await browser.close();
