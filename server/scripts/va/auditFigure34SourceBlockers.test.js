import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PUBLICATION_AUDIT_ARGS,
  main,
  parseArgs,
} from './auditFigure34SourceBlockers';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('Virginia Figure 3/4 source-blocker CLI', () => {
  it('requests the authoritative source plan needed to replay protected-core conflicts', () => {
    expect(PUBLICATION_AUDIT_ARGS.slice(1)).toEqual(['--source-plan', '--json']);
    expect(parseArgs(['--evidence-only'])).toEqual({
      json: false,
      evidenceOnly: true,
      report: null,
    });
    expect(() => parseArgs(['--write'])).toThrow(/unknown option/);
  });

  it('replays the checked 14-document evidence inventory without network or database access', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = main(['--evidence-only']);
    expect(result).toMatchObject({
      valid: true,
      evidence: {
        valid: true,
        issues: [],
        counts: {
          documents: 14,
          associate_documents: 9,
          bachelor_documents: 5,
          exact_retained_official_byte_documents: 13,
          transport_exception_documents: 1,
          figure34_remaining_action_documents: 5,
          figure34_remaining_actions: 13,
          automatable_actions_total: 2,
          automatable_actions_immediately_executable: 0,
          automatable_actions_dependency_blocked: 2,
        },
      },
    });
    expect(process.exitCode).toBeUndefined();
  });
});
