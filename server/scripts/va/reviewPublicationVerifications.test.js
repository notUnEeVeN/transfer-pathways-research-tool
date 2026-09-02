import { describe, expect, it } from 'vitest';
import { optionsFrom } from './reviewPublicationVerifications';

describe('Virginia publication verification review CLI', () => {
  it('keeps clean-receipt enforcement explicit and rejects mutation-like options', () => {
    expect(optionsFrom([])).toEqual({ json: false, requireClean: false });
    expect(optionsFrom(['--json', '--require-clean'])).toEqual({
      json: true,
      requireClean: true,
    });
    expect(() => optionsFrom(['--apply'])).toThrow(/unknown option/);
  });
});
