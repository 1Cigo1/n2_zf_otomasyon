import { test as base, expect } from '@playwright/test';
import {
  environment,
  requireCredentials,
  requireWriteAccess,
} from '../config/environments.js';

export const test = base.extend({
  env: async ({}, use, testInfo) => {
    const config = environment(
      testInfo.project.metadata.environment,
      testInfo.project.metadata.activeRole || 'short',
    );
    await use(config);
  },
  credentials: async ({ env }, use) => {
    requireCredentials(env);
    await use({ email: env.email, password: env.password });
  },
  writeAccess: async ({ env }, use) => {
    requireWriteAccess(env);
    await use(true);
  },
});
export { expect };
