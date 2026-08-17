/**
 * The one rule for scoping institution-enumerating queries to a state.
 *
 * California is the unstamped historical corpus — its documents predate the
 * state dimension and carry no `state` field, and they must keep matching
 * without a migration. Massachusetts documents are stamped `state: 'ma'` by
 * the importer. Template, agreement, and AS-degree queries are already scoped
 * through the majors registry (school ids and program pins), so this clause
 * exists for the handful of queries that enumerate institutions or colleges
 * wholesale.
 */
function stateClause(state) {
  const wanted = String(state || '').trim().toLowerCase();
  if (wanted && wanted !== 'ca') return { state: wanted };
  return { state: { $exists: false } };
}

module.exports = { stateClause };
