import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { stateClause } = cjs('./stateScope');

// California documents predate the state dimension and carry no `state`
// field; Massachusetts documents are stamped `state: 'ma'`. The clause is how
// every institution-enumerating query says which world it lives in.
describe('stateClause', () => {
  it('scopes Massachusetts to its stamp', () => {
    expect(stateClause('ma')).toEqual({ state: 'ma' });
  });

  it('scopes California to the unstamped historical corpus', () => {
    expect(stateClause('ca')).toEqual({ state: { $exists: false } });
    expect(stateClause()).toEqual({ state: { $exists: false } });
    expect(stateClause(null)).toEqual({ state: { $exists: false } });
  });
});
