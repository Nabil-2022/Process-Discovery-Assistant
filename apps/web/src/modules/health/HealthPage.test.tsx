import { describe, expect, it } from 'vitest';

import { HealthPage } from './HealthPage';

describe('HealthPage', () => {
  it('is defined', () => {
    expect(HealthPage).toBeTypeOf('function');
  });
});
