// Longest-path layering for a small DAG (≤ ~100 nodes). Pure: no DOM, no
// randomness — geometry only; callers turn columns into SVG coordinates.
export function layoutDag(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id))
  const preds = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (ids.has(e.from) && ids.has(e.to)) preds.get(e.to).push(e.from)
  }
  const memo = new Map()
  const depth = (id, seen) => {
    if (memo.has(id)) return memo.get(id)
    if (seen.has(id)) return 0 // cycle guard; validation keeps real data acyclic
    seen.add(id)
    const d = (preds.get(id) || []).reduce((best, p) => Math.max(best, depth(p, seen) + 1), 0)
    memo.set(id, d)
    return d
  }
  const depthOf = new Map(nodes.map((n) => [n.id, depth(n.id, new Set())]))
  const maxDepth = Math.max(0, ...depthOf.values())
  const columns = Array.from({ length: maxDepth + 1 }, () => [])
  for (const n of nodes) columns[depthOf.get(n.id)].push(n.id)
  for (const col of columns) col.sort()
  return { columns, depthOf }
}
