import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'assets', 'user-guide');
const BASE_URL = process.env.PDA_GUIDE_BASE_URL ?? 'http://127.0.0.1:4173';
const CHROME_PATH =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.PDA_CHROME_DEBUG_PORT ?? 9227);
const VIEWPORT = { width: 1440, height: 900 };

const routes = [
  ['01-dashboard-tenant.png', '/tenant/dashboard', 'Dashboard tenant'],
  ['02-directions.png', '/tenant/directions', 'Directions'],
  ['03-processus.png', '/tenant/processes', 'Processus'],
  ['04-nouveau-processus.png', '/tenant/processes/new', 'Nouveau processus'],
  ['05-wizard.png', '/tenant/processes/preview-process-cloture/wizard', 'Wizard'],
  ['06-atelier.png', '/tenant/processes/preview-process-cloture/workshop', 'Atelier'],
  ['07-raci.png', '/tenant/processes/preview-process-cloture/raci', 'RACI'],
  ['08-bpmn.png', '/tenant/processes/preview-process-cloture/bpmn', 'BPMN'],
  ['09-procedure.png', '/tenant/processes/preview-process-cloture/procedure', 'Procedure'],
  ['10-exports.png', '/tenant/exports', 'Exports'],
  ['11-notifications.png', '/tenant/notifications', 'Notifications'],
  ['12-audit.png', '/tenant/audit', 'Audit'],
  ['13-admin.png', '/admin', 'Administration HiGroup', 'admin'],
  [
    '14-copilote-ia.png',
    '/tenant/processes/preview-process-cloture/workshop',
    'Copilote IA',
    null,
    'Copilote IA',
  ],
  [
    '15-conformite-maroc.png',
    '/tenant/processes/preview-process-cloture/workshop',
    'Conformite Maroc',
    null,
    'Conformite Maroc',
  ],
  [
    '16-process-mining.png',
    '/tenant/processes/preview-process-cloture/workshop',
    'Process Mining',
    null,
    'Process Mining',
  ],
  ['17-mes-actions.png', '/tenant/my-actions', 'Mes actions'],
  ['18-dashboard-higroup.png', '/admin', 'Dashboard HiGroup', 'admin'],
];

function createToken(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.demo`;
}

const adminToken = createToken({
  sub: 'guide-super-admin',
  email: 'superadmin@example.test',
  global_roles: ['super_admin'],
  permissions: ['manage_platform', 'view_admin_dashboard'],
});

const adminFixtures = {
  '/api/v1/admin/dashboard/summary': {
    total_clients: 12,
    active_clients: 10,
    suspended_clients: 1,
    active_campaigns: 4,
    processes: 186,
    active_users: 74,
    subscriptions: 10,
    global_completeness_rate: 82,
    alerts: 3,
  },
  '/api/v1/admin/dashboard/tenants-attention': [
    {
      id: 'tenant-map',
      name: 'Ministere - Demo',
      slug: 'ministere-demo',
      status: 'ACTIVE',
      subscription_status: 'ACTIVE',
      processes: 42,
      users: 18,
    },
    {
      id: 'tenant-agence',
      name: 'Agence Publique - Demo',
      slug: 'agence-demo',
      status: 'ACTIVE',
      subscription_status: 'TRIAL',
      processes: 16,
      users: 9,
    },
  ],
  '/api/v1/admin/dashboard/campaigns-overview': [
    {
      id: 'campaign-2026',
      name: 'Cartographie processus 2026',
      tenant_name: 'Ministere - Demo',
      status: 'ACTIVE',
      processes: 42,
      directions: 13,
    },
  ],
  '/api/v1/admin/dashboard/recent-activity': [
    {
      id: 'act-1',
      action: 'tenant_created',
      resource_type: 'tenant',
      resource_id: 'tenant-map',
      result: 'SUCCESS',
      created_at: new Date().toISOString(),
    },
    {
      id: 'act-2',
      action: 'template_applied',
      resource_type: 'template',
      resource_id: 'template-map',
      result: 'SUCCESS',
      created_at: new Date().toISOString(),
    },
  ],
};

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      const callbacks = this.listeners.get(message.method) ?? [];
      callbacks.forEach((callback) => callback(message));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }
}

async function waitForDebugPort() {
  const versionUrl = `http://127.0.0.1:${PORT}/json/version`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(versionUrl);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Chrome DevTools endpoint unavailable.');
}

async function createPage() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/new?${BASE_URL}`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Unable to create Chrome page: ${response.status}`);
  }
  return response.json();
}

async function waitForLoad(client) {
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    client.on('Page.loadEventFired', () => {
      clearTimeout(timer);
      setTimeout(resolve, 900);
    });
  });
}

async function navigate(client, route, mode) {
  await client.send('Page.navigate', { url: BASE_URL });
  await waitForLoad(client);
  await client.send('Runtime.evaluate', {
    expression:
      mode === 'admin'
        ? `localStorage.setItem('pda_access_token', ${JSON.stringify(adminToken)});`
        : "localStorage.removeItem('pda_access_token'); localStorage.removeItem('pda_support_grant_id');",
    awaitPromise: true,
  });
  await client.send('Page.navigate', { url: `${BASE_URL}${route}` });
  await waitForLoad(client);
}

async function clickText(client, text) {
  const result = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const target = Array.from(document.querySelectorAll('button, a, [role="tab"]'))
          .find((element) => element.textContent && element.textContent.trim().includes(${JSON.stringify(text)}));
        if (!target) return false;
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return true;
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  return Boolean(result.result?.value);
}

async function capture(client, fileName) {
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const filePath = path.join(OUT_DIR, fileName);
  await writeFile(filePath, Buffer.from(screenshot.data, 'base64'));
  const info = await stat(filePath);
  return info.size;
}

async function installAdminMocks(client) {
  await client.send('Fetch.enable', {
    patterns: [{ urlPattern: '*://*/api/v1/admin/*' }],
  });
  client.on('Fetch.requestPaused', async (event) => {
    try {
      const url = new URL(event.params.request.url);
      const key = url.pathname;
      const body = JSON.stringify(adminFixtures[key] ?? []);
      const headers = [
        { name: 'access-control-allow-origin', value: BASE_URL },
        { name: 'access-control-allow-credentials', value: 'true' },
        { name: 'access-control-allow-headers', value: 'authorization, content-type' },
        { name: 'access-control-allow-methods', value: 'GET, POST, PUT, OPTIONS' },
      ];
      if (event.params.request.method === 'OPTIONS') {
        await client.send('Fetch.fulfillRequest', {
          requestId: event.params.requestId,
          responseCode: 204,
          responseHeaders: headers,
        });
        return;
      }
      await client.send('Fetch.fulfillRequest', {
        requestId: event.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }, ...headers],
        body: Buffer.from(body).toString('base64'),
      });
    } catch {
      await client.send('Fetch.continueRequest', {
        requestId: event.params.requestId,
      });
    }
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating screenshots from ${BASE_URL}`);
  console.log(`Output directory: ${OUT_DIR}`);
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'pda-guide-chrome-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--disable-features=CalculateNativeWinOcclusion',
    '--remote-allow-origins=*',
    '--no-sandbox',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    BASE_URL,
  ]);

  chrome.stderr.on('data', () => {});
  chrome.on('exit', (code, signal) => {
    console.log(`Chrome exited: code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  });
  chrome.on('error', (error) => {
    console.error(`Chrome spawn error: ${error.message}`);
  });

  try {
    await waitForDebugPort();
    console.log('Chrome DevTools endpoint ready');
    const page = await createPage();
    console.log(`Created page ${page.id ?? ''}`);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const client = new CdpClient(ws);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await installAdminMocks(client);

    const summary = [];
    for (const [fileName, route, label, mode, tabLabel] of routes) {
      console.log(`Capturing ${fileName} (${label})`);
      await navigate(client, route, mode);
      if (tabLabel) await clickText(client, tabLabel);
      const size = await capture(client, fileName);
      summary.push({ fileName, route, label, size, status: size > 10_000 ? 'OK' : 'KO' });
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    chrome.kill();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
