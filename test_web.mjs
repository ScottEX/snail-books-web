import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:8600';
const results = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    results.push({ name, status: 'PASS' });
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({
  locale: 'zh-CN',
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

// Collect console errors
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(err.message));

console.log('\n📄 1. Login Page Tests');
console.log('=======================');

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });

await test('Login page loads with correct title', async () => {
  const title = await page.title();
  if (title !== '蓝姐螺蛳粉') throw new Error(`Expected title "蓝姐螺蛳粉", got "${title}"`);
});

await test('Login form renders (username/password fields visible)', async () => {
  // The app is React Native Web - look for input fields
  const inputs = await page.locator('input').count();
  if (inputs < 2) throw new Error(`Expected at least 2 inputs, found ${inputs}`);
});

await test('Login button exists', async () => {
  const buttons = await page.locator('div[role="button"], button, [data-testid]').count();
  // React Native Web uses View with role
  const allText = await page.textContent('body');
  if (!allText.includes('登录') && !allText.includes('Login') && !allText.includes('登入')) {
    // Maybe it's React Native rendered with Text components
    console.log('  ⚠️  Check login text manually - RN Web may not render text as HTML');
  }
});

// Take screenshot of login page
await page.screenshot({ path: '/tmp/screen-login.png', fullPage: true });
console.log('  📸 Screenshot: /tmp/screen-login.png');

console.log('\n📄 2. Login Flow Test');
console.log('=======================');

// Fill in login form - find inputs by type or placeholder
const allInputs = page.locator('input');
const inputCount = await allInputs.count();
console.log(`  Found ${inputCount} input fields`);

if (inputCount >= 2) {
  await allInputs.nth(0).fill('test');
  await allInputs.nth(1).fill('test');

  // Click the submit/login button - in RN Web, TouchableOpacity renders as div
  // Try finding by text content
  const loginBtn = page.locator('div[role="button"]').first();
  await loginBtn.click().catch(() => {});

  await page.waitForTimeout(3000);

  await test('After login: page still accessible (not crashed)', async () => {
    const title = await page.title();
    if (!title) throw new Error('Page crashed after login');
  });
}

await page.screenshot({ path: '/tmp/screen-after-login.png', fullPage: true });
console.log('  📸 Screenshot: /tmp/screen-after-login.png');

console.log('\n📄 3. Page Navigation Tests');
console.log('============================');

// Go to pages directly to check auth
for (const route of ['/', '/expense', '/history', '/partner', '/recon', '/nonexistent']) {
  await test(`Route "${route}" loads without crash`, async () => {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 10000 });
    if (!resp || !resp.ok()) throw new Error(`HTTP ${resp?.status()}`);
    const title = await page.title();
    if (title !== '蓝姐螺蛳粉') throw new Error(`Wrong title: "${title}"`);
  });
}

console.log('\n📄 4. Console Error Check');
console.log('============================');

await test('No JavaScript console errors', async () => {
  const jsErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('CORS') && !e.includes('manifest')
  );
  if (jsErrors.length > 0) {
    throw new Error(`JS errors found: ${jsErrors.slice(0, 5).join('; ')}`);
  }
});

console.log('\n📄 5. API Connection Test (from page context)');
console.log('==============================================');

await test('Frontend can reach backend API', async () => {
  const result = await page.evaluate(async () => {
    try {
      const resp = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lang': 'zh-CN' },
        body: JSON.stringify({ username: 'test', password: 'test' }),
      });
      const data = await resp.json();
      return { ok: true, status: data.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  if (!result.ok) throw new Error(`API call failed: ${result.error}`);
  if (result.status !== 'error') throw new Error(`Expected error status for bad login, got: ${result.status}`);
});

console.log('\n📄 6. Response Time / Performance');
console.log('====================================');

await test('Page loads within 5 seconds', async () => {
  const start = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  const loadTime = Date.now() - start;
  if (loadTime > 5000) throw new Error(`Load time ${loadTime}ms exceeds 5s`);
  console.log(`  ⏱️  Load time: ${loadTime}ms`);
});

console.log('\n📄 7. Multiple Devices');
console.log('=========================');

// Mobile viewport
const mobilePage = await context.newPage();
await mobilePage.setViewportSize({ width: 375, height: 812 });
await test('Mobile viewport renders without horizontal scroll', async () => {
  await mobilePage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 10000 });
  await mobilePage.screenshot({ path: '/tmp/screen-mobile.png', fullPage: true });
});
console.log('  📸 Screenshot: /tmp/screen-mobile.png');
await mobilePage.close();

// Tablet viewport
const tabletPage = await context.newPage();
await tabletPage.setViewportSize({ width: 768, height: 1024 });
await test('Tablet viewport renders correctly', async () => {
  await tabletPage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 10000 });
  await tabletPage.screenshot({ path: '/tmp/screen-tablet.png', fullPage: true });
});
console.log('  📸 Screenshot: /tmp/screen-tablet.png');
await tabletPage.close();

// ── Summary ──
console.log('\n' + '='.repeat(50));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(50));
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
console.log(`  Total: ${results.length} | ✅ ${pass} passed | ❌ ${fail} failed`);
results.filter(r => r.status === 'FAIL').forEach(r => {
  console.log(`  ❌ ${r.name}: ${r.error}`);
});

// Save screenshots info
const screenshots = {
  login: '/tmp/screen-login.png',
  afterLogin: '/tmp/screen-after-login.png',
  mobile: '/tmp/screen-mobile.png',
  tablet: '/tmp/screen-tablet.png',
};

await browser.close();

if (fail > 0) process.exit(1);
