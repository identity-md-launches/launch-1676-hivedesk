// Browser validation only. The EIP-6963 provider below simulates wallet UI without keys,
// signatures or transactions. Account addresses and expected balances come from the
// pinned deployment and live Ethereum reads; this code is never imported by the site.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createPublicClient, fallback, formatUnits, getAddress, http as rpcHttp } from 'viem';

const root = resolve(process.env.HIVEDESK_DIST || fileURLToPath(new URL('../../dist/', import.meta.url)));
const output = resolve(process.env.HIVEDESK_REPORT || fileURLToPath(new URL('../../artifacts/', import.meta.url)));
const deployment = JSON.parse(await readFile(new URL('../config/deployment.json', import.meta.url), 'utf8'));
const { network } = JSON.parse(await readFile(new URL('../config/network.json', import.meta.url), 'utf8'));
const abi = JSON.parse(await readFile(new URL('../config/abis/HiveDeskToken.json', import.meta.url), 'utf8'));
const token = deployment.contracts.find((entry) => entry.name === 'HiveDeskToken');
assert.ok(token?.address, 'This live interaction check requires the pinned token.');
const accounts = [getAddress(deployment.manifest.economics.remainderTo), getAddress(token.address)];
const client = createPublicClient({ transport: fallback(network.rpcUrls.map((url) => rpcHttp(url, { timeout: 10000, retryCount: 0 })), { retryCount: 0 }) });
const blockNumber = await client.getBlockNumber();
const contract = { address: token.address, abi, blockNumber };
const [name, symbol, decimals, supply, firstBalance, secondBalance] = await Promise.all([
  ...['name', 'symbol', 'decimals', 'totalSupply'].map((functionName) => client.readContract({ ...contract, functionName })),
  ...accounts.map((account) => client.readContract({ ...contract, functionName: 'balanceOf', args: [account] })),
]);
const amount = (value) => {
  const [integer, fraction] = formatUnits(value, decimals).split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
};
await mkdir(resolve(output, 'screenshots'), { recursive: true });
const report = { generatedAt: new Date().toISOString(), export: root, sourceBlock: String(blockNumber), walletSimulation: 'EIP-6963 provider only; real pinned accounts and live balance reads; no signing or transactions', checks: [], limitations: ['No physical phone or installed wallet extension was used.', 'Coinbase passkey authorization and native wallet deep-link handoff were not completed.', 'Automated accessibility checks do not replace a screen-reader session.'] };
const record = (browser, name, detail = '') => { report.checks.push({ browser, name, passed: true, detail }); console.log(`PASS ${browser}: ${name}`); };

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (!pathname.startsWith('/preview/')) { response.writeHead(404).end(); return; }
  const path = resolve(root, pathname.slice('/preview/'.length) || 'index.html');
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try { response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const until = async (page, fn, argument) => page.waitForFunction(fn, argument, { timeout: 45000 });
const readReady = (page) => page.locator('[data-testid="total-supply"]').waitFor({ timeout: 45000 });
const noOverflow = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
const awaiting = async (page) => {
  for (const text of await page.locator('[data-awaiting-section]').allTextContents()) {
    assert.match(text, /Awaiting deployment/);
    assert.doesNotMatch(text, /\d/);
  }
};
const openWallet = (page) => page.locator('.connect-button').click();

// A controlled provider lets us validate rejection, pending, account changes and
// unsupported networks without asking a person to authorize a real wallet.
function installWallet({ accounts, chainId }) {
  let account = sessionStorage.getItem('validation-account') || accounts[0];
  let authorized = sessionStorage.getItem('validation-authorized') === 'yes';
  let chain = Number(sessionStorage.getItem('validation-chain') || chainId);
  let known = true;
  let reject = false;
  let hold = false;
  let release;
  const methods = [];
  const listeners = new Map();
  const emit = (event, value) => (listeners.get(event) || []).forEach((fn) => fn(value));
  const provider = {
    on(event, fn) { listeners.set(event, [...(listeners.get(event) || []), fn]); },
    removeListener(event, fn) { listeners.set(event, (listeners.get(event) || []).filter((entry) => entry !== fn)); },
    async request({ method, params }) {
      methods.push({ method, params });
      if (method === 'eth_chainId') return `0x${chain.toString(16)}`;
      if (method === 'eth_accounts') return authorized ? [account] : [];
      if (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions') {
        if (reject) { reject = false; throw Object.assign(new Error('Test rejection'), { code: 4001 }); }
        if (hold) await new Promise((resolve) => { release = resolve; });
        authorized = true;
        sessionStorage.setItem('validation-authorized', 'yes');
        return method === 'eth_requestAccounts' ? [account] : [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'wallet_switchEthereumChain') {
        if (reject) { reject = false; throw Object.assign(new Error('Test rejection'), { code: 4001 }); }
        if (!known) throw Object.assign(new Error('Test unknown chain'), { code: 4902 });
        chain = Number(params[0].chainId);
        sessionStorage.setItem('validation-chain', chain);
        emit('chainChanged', params[0].chainId);
        return null;
      }
      if (method === 'wallet_addEthereumChain') { known = true; return null; }
      if (method === 'wallet_revokePermissions') { authorized = false; sessionStorage.removeItem('validation-authorized'); return null; }
      if (method === 'wallet_getPermissions') return authorized ? [{ parentCapability: 'eth_accounts' }] : [];
      throw new Error(`Unapproved test provider method: ${method}`);
    },
  };
  window.__validationWallet = {
    methods,
    rejectNext() { reject = true; },
    holdNext() { hold = true; },
    release() { hold = false; release?.(); },
    setChain(value, isKnown = true) { chain = value; known = isKnown; emit('chainChanged', `0x${value.toString(16)}`); },
    setAccount(value) { account = value; sessionStorage.setItem('validation-account', value); emit('accountsChanged', [value]); },
  };
  const announce = () => {
    for (const walletName of ['Validation wallet', 'Second validation wallet']) {
      const uuid = walletName === 'Validation wallet' ? 'c52c4f4e-1344-4279-9b83-cfe3c5ee6abc' : 'ec729bb9-9fd5-4450-a4b6-9e2b67c7fabc';
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid, name: walletName, icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f1cb48"/%3E%3C/svg%3E', rdns: walletName === 'Validation wallet' ? 'test.validation' : 'test.validation-second' }, provider } }));
    }
  };
  addEventListener('eip6963:requestProvider', announce);
  announce();
}

let activeBrowser;
try {
  for (const [browserName, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    activeBrowser = await launcher.launch({ headless: true });
    const context = await activeBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const missing = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.url().startsWith(url) && response.status() >= 400) missing.push(response.url()); });
    await page.goto(url);
    await readReady(page);
    assert.equal((await page.locator('[data-testid="total-supply"]').textContent()).trim(), `${amount(supply)} ${symbol}`);
    assert.equal(await page.locator('.token-metadata dd').first().textContent(), name);
    assert.equal(await page.locator('.token-metadata dd').nth(1).textContent(), symbol);
    assert.match(await page.locator('.contract-detail .full-address').getAttribute('href'), new RegExp(token.address, 'i'));
    await awaiting(page);
    record(browserName, 'Live metadata, supply, pinned explorer link; every undeployed section has no digits');
    assert.equal((await page.request.get(new URL('share.png', url).href)).status(), 200);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
      await noOverflow(page);
      // Let WebKit repaint SVG artwork after viewport changes before capturing evidence.
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      });
      if (width === 390) {
        for (const selector of ['h1', '.connect-button', '.supply-value']) {
          const box = await page.locator(selector).boundingBox();
          assert.ok(box.y >= 0 && box.y + box.height <= 844, `${selector} not on first screen`);
        }
        await page.screenshot({ path: resolve(output, 'screenshots', `${browserName}-390.png`) });
      }
    }
    await page.screenshot({ path: resolve(output, 'screenshots', `${browserName}-1440.png`), fullPage: true });
    record(browserName, 'Responsive reflow at 320, 390, 768, 1024, 1440; first-screen product and action at 390');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(audit.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })), []);
    record(browserName, 'Automated accessibility scan of loaded dashboard', `${audit.passes.length} rules passed; no violations`);

    await page.getByRole('link', { name: 'Performance', exact: true }).click();
    assert.ok(page.url().endsWith('#performance'));
    await page.getByRole('link', { name: 'Activity', exact: true }).click();
    assert.ok(page.url().endsWith('#activity'));
    await page.goto(url);
    await readReady(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copied = text; } } });
    });
    await page.getByRole('button', { name: 'Copy address', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__copied), getAddress(token.address));
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Test clipboard denial'); }; });
    await page.getByRole('button', { name: 'Copied', exact: true }).click();
    await page.getByText('Copy unavailable. Select the address to copy it.').waitFor();
    record(browserName, 'Hash navigation, copy success and clipboard-denied recovery');
    await openWallet(page);
    assert.equal(await page.getByRole('button', { name: 'Browser wallet', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Browser wallet', exact: true }).click();
    await page.getByText('No browser wallet found.', { exact: false }).waitFor();
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'Focus escaped modal');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate((dialog) => dialog.open), false);
    assert.ok(await page.locator('.connect-button').evaluate((button) => button === document.activeElement));
    await openWallet(page);
    await page.mouse.click(5, 5);
    assert.equal(await page.locator('dialog').evaluate((dialog) => dialog.open), false);
    record(browserName, 'No-extension error, modal focus trap, Escape/backdrop dismissal and focus restoration');

    await page.route('https://ethereum-rpc.publicnode.com/**', (route) => route.abort());
    await page.getByRole('button', { name: 'Refresh token details' }).click();
    await readReady(page);
    record(browserName, 'Secondary RPC recovers from primary endpoint failure');
    await page.route('https://eth.drpc.org/**', (route) => route.abort());
    await page.getByRole('button', { name: 'Refresh token details' }).click();
    await page.getByText('Token data unavailable', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-testid="total-supply"]').count(), 0);
    await awaiting(page);
    await page.screenshot({ path: resolve(output, 'screenshots', `${browserName}-rpc-error.png`) });
    await page.unroute('https://ethereum-rpc.publicnode.com/**');
    await page.unroute('https://eth.drpc.org/**');
    await page.getByRole('button', { name: 'Retry token read' }).click();
    await readReady(page);
    record(browserName, 'RPC failure hides numbers, reports error; retry restores actual data');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.deepEqual(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length), 0);
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    record(browserName, 'Reduced motion and 200% CSS text enlargement reflow', 'CSS text enlargement, not browser-native zoom');
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    record(browserName, 'No page exceptions or missing local resources');
    await context.close();

    const mobile = await activeBrowser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
    const phone = await mobile.newPage();
    await phone.goto(url);
    await openWallet(phone);
    for (const wallet of ['MetaMask', 'Coinbase Wallet', 'Rabby', 'Phantom']) {
      const link = phone.getByRole('link', { name: `Open in ${wallet}`, exact: true });
      const href = await link.getAttribute('href');
      assert.ok(decodeURIComponent(href).includes('/preview/'), `${wallet} link lost path`);
      assert.ok((await link.boundingBox()).height >= 48);
    }
    assert.equal(await phone.getByRole('button', { name: 'Browser wallet', exact: true }).count(), 0);
    await phone.getByRole('button', { name: 'Coinbase Smart Wallet', exact: true }).waitFor();
    const dialogBox = await phone.locator('dialog').boundingBox();
    assert.ok(Math.abs(dialogBox.y + dialogBox.height - 844) < 2);
    await phone.screenshot({ path: resolve(output, 'screenshots', `${browserName}-mobile-wallets.png`) });
    const mobileAudit = await new AxeBuilder({ page: phone }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.equal(mobileAudit.violations.length, 0, JSON.stringify(mobileAudit.violations));
    record(browserName, 'Phone bottom sheet, four correct deep links, Coinbase Smart Wallet, 48px rows, accessible dialog');
    await mobile.close();

    const walletContext = await activeBrowser.newContext({ viewport: { width: 390, height: 844 } });
    await walletContext.addInitScript(installWallet, { accounts, chainId: network.chainId });
    const walletPage = await walletContext.newPage();
    await walletPage.goto(url);
    await readReady(walletPage);
    await openWallet(walletPage);
    assert.equal(await walletPage.getByRole('button', { name: 'Browser wallet', exact: true }).count(), 0);
    assert.equal(await walletPage.getByRole('button', { name: 'Second validation wallet', exact: true }).count(), 1);
    await walletPage.evaluate(() => window.__validationWallet.rejectNext());
    await walletPage.getByRole('button', { name: 'Validation wallet', exact: true }).click();
    await walletPage.getByText('Connection declined. Choose a wallet to try again.').waitFor();
    await walletPage.evaluate(() => window.__validationWallet.holdNext());
    await walletPage.getByRole('button', { name: 'Validation wallet', exact: true }).click();
    await walletPage.getByText('Validation wallet · opening…').waitFor();
    assert.ok(await walletPage.getByRole('button', { name: 'Second validation wallet', exact: true }).isDisabled());
    await walletPage.evaluate(() => window.__validationWallet.release());
    await until(walletPage, (expected) => document.querySelector('[data-testid="wallet-balance"]')?.textContent.trim() === expected, `${amount(firstBalance)} ${symbol}`);
    await walletPage.screenshot({ path: resolve(output, 'screenshots', `${browserName}-connected.png`), fullPage: true });
    record(browserName, 'EIP-6963 discovery, rejection, pending and successful balance read for pinned recipient');
    await walletPage.evaluate((account) => window.__validationWallet.setAccount(account), accounts[1]);
    await until(walletPage, (expected) => document.querySelector('[data-testid="wallet-balance"]')?.textContent.trim() === expected, `${amount(secondBalance)} ${symbol}`);
    record(browserName, 'Account change fetches the new account balance; no stale previous position');
    await walletPage.route('https://ethereum-rpc.publicnode.com/**', (route) => route.abort());
    await walletPage.route('https://eth.drpc.org/**', (route) => route.abort());
    await walletPage.getByRole('button', { name: 'Refresh wallet balance' }).click();
    await walletPage.getByText('Balance unavailable', { exact: true }).waitFor();
    assert.equal(await walletPage.locator('[data-testid="wallet-balance"]').count(), 0);
    await walletPage.unroute('https://ethereum-rpc.publicnode.com/**');
    await walletPage.unroute('https://eth.drpc.org/**');
    await walletPage.getByRole('button', { name: 'Retry balance read' }).click();
    await until(walletPage, (expected) => document.querySelector('[data-testid="wallet-balance"]')?.textContent.trim() === expected, `${amount(secondBalance)} ${symbol}`);
    record(browserName, 'Balance read failure hides previous amount; retry fetches the actual balance');
    await walletPage.evaluate(() => window.__validationWallet.setChain(10, false));
    await walletPage.getByRole('button', { name: `Switch to ${network.name}`, exact: true }).waitFor();
    assert.equal(await walletPage.locator('[data-testid="wallet-balance"]').count(), 0);
    await walletPage.evaluate(() => window.__validationWallet.rejectNext());
    await walletPage.getByRole('button', { name: `Switch to ${network.name}`, exact: true }).click();
    await walletPage.getByText('Network switch declined. Try again when you are ready.').waitFor();
    assert.equal(await walletPage.locator('[data-testid="wallet-balance"]').count(), 0);
    await walletPage.locator('dialog').getByRole('button', { name: `Switch to ${network.name}`, exact: true }).click();
    await until(walletPage, () => Boolean(document.querySelector('[data-testid="wallet-balance"]')));
    await walletPage.getByRole('button', { name: 'Close wallet dialog' }).click();
    const added = await walletPage.evaluate(() => window.__validationWallet.methods.find((entry) => entry.method === 'wallet_addEthereumChain'));
    assert.equal(Number(added.params[0].chainId), network.chainId);
    assert.deepEqual(added.params[0].rpcUrls, network.rpcUrls);
    record(browserName, 'Wrong chain and rejected switch hide balance; retry with unknown-chain fallback uses pinned network parameters');
    await walletPage.reload();
    await until(walletPage, () => Boolean(document.querySelector('[data-testid="wallet-balance"]')));
    await openWallet(walletPage);
    assert.equal(await walletPage.locator('dialog .full-address').textContent(), `${accounts[1]} on Etherscan (opens in a new tab)`);
    await walletPage.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await walletPage.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
    assert.equal(await walletPage.locator('[data-testid="wallet-balance"]').count(), 0);
    const called = await walletPage.evaluate(() => window.__validationWallet.methods.map((entry) => entry.method));
    assert.ok(called.every((method) => !/sign|sendTransaction|sendCalls|write/i.test(method)), 'Unexpected wallet write/signature');
    await awaiting(walletPage);
    record(browserName, 'Reload reconnects; disconnect clears position; no wallet signing or transaction method invoked');
    await walletContext.close();
    await activeBrowser.close();
    activeBrowser = undefined;
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await activeBrowser?.close();
  server.close();
  await writeFile(resolve(output, 'interaction-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Recorded ${report.checks.length} checks in ${output}/interaction-results.json`);
}
