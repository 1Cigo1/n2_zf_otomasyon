import { defineConfig, devices } from '@playwright/test';
import { environments, environment } from './config/environments.js';

// Eski .env dosyalarındaki TRACE=off otomatik hata kaydını kapatmasın.
// Gerektiğinde FYS_TRACE=off ile bilinçli olarak kapatılabilir.
const legacyTrace = process.env.TRACE?.trim();
const traceMode = process.env.FYS_TRACE?.trim()
  || (legacyTrace && legacyTrace.toLowerCase() !== 'off'
    ? legacyTrace : 'retain-on-failure');

const reporters = process.env.CI
  // HTML raporu form adımlarındaki girilen değerleri taşıyabildiği için CI
  // artefaktına eklenmez. JUnit GitLab Tests görünümü için yeterlidir.
  ? [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]]
  : [
      ['list'],
      ['html', { open: 'never' }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
    ];

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/local/**',
  timeout: Number(process.env.TEST_TIMEOUT_MS || 240000),
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0, // Yeniden deneme, ikinci bir yıkama talebi oluşturmasın.
  forbidOnly: !!process.env.CI,
  outputDir: 'test-results',
  reporter: reporters,
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: Number(process.env.ACTION_TIMEOUT_MS || 15000),
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    trace: traceMode,
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
  },
  projects: environments().flatMap(name => {
    const suites = [
      'login', 'washing', 'mono', 'short-term', 'corporate-short-term', 'api',
      ...(name === 'dev' ? ['long-term', 'monthly', 'fayt-maintenance', 'broker'] : ['fayt-fuel']),
    ];
    return suites.map(suite => ({
      name: suite === 'broker' ? 'dev-broker' : `${name}-${suite}`,
      testMatch: suite === 'api' ? '**/api/*.spec.js'
        : suite === 'broker' ? '**/broker/*.spec.js'
          : `**/ui/${suite}.spec.js`,
      metadata: { environment: name, activeRole: suite === 'long-term' ? 'long' : 'short' },
      use: {
        baseURL: environment(name).baseURL,
        ...(suite === 'broker' ? { trace: 'off', video: 'off', screenshot: 'off' } : {}),
      },
    }));
  }),
});
