import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
function loadEnv(file: URL) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && !key.trim().startsWith('#') && !(key.trim() in process.env)) process.env[key.trim()] = rest.join('=').trim().replace(/^"(.*)"$/, '$1');
  }
}
loadEnv(new URL('.env.local', import.meta.url)); // configurazione reale locale (gitignored)
loadEnv(new URL('.env.test', import.meta.url));  // credenziali account di test
const port = 3210;
const localHttps = process.env.E2E_LOCAL_HTTPS === '1' && !process.env.E2E_BASE_URL;
const baseURL = process.env.E2E_BASE_URL || (localHttps ? 'https://127.0.0.1:3443' : `http://127.0.0.1:${port}`);
const passthrough: Record<string, string> = {};
for (const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_INSTANCE_ID','SUPABASE_AUTH_COOKIE_NAME','SUPABASE_SERVICE_ROLE_KEY','ALLOW_AUTH_ACCOUNT_DELETION','DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','DEEPSEEK_VISION','DOCUMENT_OCR_ENABLED','AI_TIMEOUT_SECONDS','TAVILY_API_KEY','TAVILY_BASE_URL','WEB_SEARCH_MAX_RESULTS','WEB_FETCH_TIMEOUT_SECONDS','WEB_FETCH_MAX_BYTES','WEB_FETCH_ALLOW_PRIVATE','WEB_SEARCH_PROVIDER','OPENROUTER_API_KEY','OPENROUTER_BASE_URL','OPENROUTER_WEB_MODEL','WEB_DAILY_LIMIT','IMAGE_API_KEY','IMAGE_BASE_URL','IMAGE_MODEL','IMAGE_SIZE','IMAGE_DAILY_LIMIT','AI_MAX_OUTPUT_TOKENS','AI_INPUT_USD_PER_MILLION','AI_OUTPUT_USD_PER_MILLION','AI_DAILY_CALL_LIMIT','OLLAMA_BASE_URL','EMBEDDING_MODEL'])
  if (process.env[key]) passthrough[key] = process.env[key];
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/e2e/artifacts',
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL, ignoreHTTPSErrors: localHttps, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /(preview\.(desktop|mobile)\.spec\.ts|mobile\.spec\.ts)/ },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, dependencies: ['setup'], testIgnore: /preview\.(desktop|mobile)\.spec\.ts/ },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] }, dependencies: ['setup'], testMatch: /(mobile-layout|install|islands|web-images|auto-video|autosave-auth|artifacts-auth)\.spec\.ts/ },
    { name: 'preview', use: { ...devices['Desktop Chrome'] }, testMatch: /preview\.desktop\.spec\.ts/ },
    { name: 'preview-mobile', use: { ...devices['Pixel 7'] }, testMatch: /preview\.mobile\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `node scripts/start.mjs --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    // Il runner HTTPS proxy usa 3443; la readiness del BFF resta sulla porta interna 3210.
    env: { APP_URL: baseURL, APP_ORIGINS: baseURL, PORT: String(port), HOSTNAME: '127.0.0.1', ...passthrough },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
