import { test, expect } from '@playwright/test';
import { findLeaks } from '../../scripts/check-leak.mjs';
import { records } from './helpers.mjs';

test('the fixture build holds no hidden text outside its own tier paths', () => {
  expect(findLeaks({ dist: '.e2e-dist', records })).toEqual([]);
});
