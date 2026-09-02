import { describe, expect, it, vi } from 'vitest';
import {
  FETCH_TIMEOUT_MS,
  fetchText,
} from './captureRadfordSciencePairEvidence';

describe('Radford science-pair source acquisition', () => {
  it('applies a bounded AbortSignal to every request', async () => {
    const fetchImpl = vi.fn(async (url, options) => ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => 'text/plain' },
      text: async () => 'ok',
      options,
    }));

    await expect(fetchText('https://example.edu/robots.txt', 'text/plain', {
      fetchImpl,
    })).resolves.toMatchObject({ body: 'ok', status: 200 });
    expect(FETCH_TIMEOUT_MS).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.edu/robots.txt',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('fails with the exact URL instead of hanging past the request deadline', async () => {
    const fetchImpl = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));

    await expect(fetchText('https://example.edu/stalled', 'text/html', {
      fetchImpl,
      timeoutMs: 5,
    })).rejects.toThrow('https://example.edu/stalled timed out after 5ms');
  });
});
