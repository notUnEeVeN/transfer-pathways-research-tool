import { describe, it, expect, vi } from 'vitest';
import { listMajorsEndpoint } from './Majors';

describe('GET /majors', () => {
  it('returns serialized majors and the default slug', async () => {
    const json = vi.fn();
    await listMajorsEndpoint({}, { json }, vi.fn());
    const payload = json.mock.calls[0][0];
    expect(payload.default).toBe('cs');
    expect(payload.majors.map((m) => m.slug)).toEqual(['cs']);
  });

  it('payload survives a JSON round-trip with regex sources intact', async () => {
    const json = vi.fn();
    await listMajorsEndpoint({}, { json }, vi.fn());
    const round = JSON.parse(JSON.stringify(json.mock.calls[0][0]));
    expect(round.majors[0].coursePatterns.discreteMath.source).toBeTruthy();
    expect(round.majors[0].programs['79']).toContain('Computer Science, B.A.');
    expect(round.majors[0].capabilities.asDegrees).toBe(true);
  });
});
