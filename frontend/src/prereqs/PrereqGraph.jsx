/* ============================================================================
   PrereqGraph.jsx — prerequisite concept graph, swim-lane redesign
   Transfer Pathways Research console.

   Layout model: discipline swim-lanes (rows) × prerequisite depth (columns).
   - Within a lane, prerequisite CHAINS claim whole rows (longest first), so
     the calc spine / physics sequences / CS1→CS3 each read as one straight line.
   - Unlinked concepts render dashed in their lane's empty cells (no extra height).
   - Edges: orthogonal rounded elbows routed in column gutters; same-source
     edges bundle into one trunk that branches per target row; parallel trunks
     get gutter tracks via interval coloring; multi-parent targets stagger entries.
   - satisfies (combined-course equivalence): dashed, no arrow, dot terminator, '≡' badge.
   - Focus: click / Enter traces ancestors + descendants, fades the rest. Esc clears.
     The rules table below the graph remains the no-interaction fallback.

   No libraries. Deterministic. Colors only via CSS vars with fallbacks.
   Design handoff: docs/handoff 2/PREREQ-GRAPH-HANDOFF.md (demo + mockups there).
   ========================================================================== */
import React, { useState, useMemo, useCallback } from 'react';

/* ---- discipline system --------------------------------------------------- */
const LANE_ORDER = ['math', 'stats', 'physics', 'engr', 'cs', 'chem', 'bio', 'other'];
const LANE_LABEL = { math: 'Math', stats: 'Stats', physics: 'Physics', engr: 'Engineering', cs: 'Computer Sci', chem: 'Chemistry', bio: 'Biology', other: 'Gen Ed / Other' };
/* Mid-tone hues (survive light + dark). Override per-theme via --dg-* vars. */
const DISC = {
  math: 'var(--dg-math, #2F7D53)',
  stats: 'var(--dg-stats, #B14E86)',
  physics: 'var(--dg-physics, var(--color-conservative, #6C4FD0))',
  engr: 'var(--dg-engr, #97762B)',
  cs: 'var(--dg-cs, #3D7DB8)',
  chem: 'var(--dg-chem, #C26A2E)',
  bio: 'var(--dg-bio, #7D9B2E)',
  other: 'var(--dg-other, #77807A)',
};
const V = {
  surface: 'var(--color-surface, #FFFFFF)',
  canvas: 'var(--color-canvas, #FFFFFF)',
  border: 'var(--color-border, #DFE3D8)',
  borderStrong: 'var(--color-border-strong, #B9C0AC)',
  ink: 'var(--color-ink, #193018)',
  inkMuted: 'var(--color-ink-muted, #3F4840)',
  inkSubtle: 'var(--color-ink-subtle, #5F6A60)',
  primary: 'var(--color-primary, #193018)',
  accent: 'var(--color-accent, #96F060)',
  sunken: 'var(--color-surface-sunken, #F1F3EB)',
};

/* ---- layout -------------------------------------------------------------- */
const RAIL = 92, COL_W = 206, NODE_W = 168, HEAD = 26;

export function computePrereqLayout(nodes, reqEdges, { compact }) {
  const M = compact ? { nodeH: 31, pitch: 38, lanePad: 7 } : { nodeH: 36, pitch: 44, lanePad: 8 };
  const byId = new Map(nodes.map((n, i) => [n.slug, Object.assign(n, { idx: i })]));
  const parents = new Map(nodes.map(n => [n.slug, []]));
  const children = new Map(nodes.map(n => [n.slug, []]));
  for (const e of reqEdges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    parents.get(e.to).push(e.from); children.get(e.from).push(e.to);
  }
  const depth = new Map(), visiting = new Set();
  const depthOf = s => {
    if (depth.has(s)) return depth.get(s);
    if (visiting.has(s)) return 0; /* cycle guard */
    visiting.add(s);
    const ps = parents.get(s) || [];
    const d = ps.length ? Math.max(...ps.map(depthOf)) + 1 : 0;
    visiting.delete(s); depth.set(s, d); return d;
  };
  nodes.forEach(n => { n.depth = depthOf(n.slug); });
  const maxCol = Math.max(0, ...nodes.map(n => n.depth));
  const linked = new Set();
  reqEdges.forEach(e => { linked.add(e.from); linked.add(e.to); });

  const lanes = LANE_ORDER.filter(d => nodes.some(n => n.discipline === d))
    .concat([...new Set(nodes.map(n => n.discipline))].filter(d => !LANE_ORDER.includes(d)));

  /* chains: follow primary same-lane parent links */
  const chainOf = new Map(), chains = [], continued = new Set();
  const sorted = [...nodes].filter(n => linked.has(n.slug)).sort((a, b) => a.depth - b.depth || a.idx - b.idx);
  for (const n of sorted) {
    const sameLaneParents = (parents.get(n.slug) || []).map(s => byId.get(s))
      .filter(p => p && p.discipline === n.discipline && p.depth < n.depth)
      .sort((a, b) => b.depth - a.depth || a.idx - b.idx);
    const prim = sameLaneParents[0];
    if (prim && !continued.has(prim.slug)) {
      const c = chainOf.get(prim.slug); c.members.push(n); chainOf.set(n.slug, c); continued.add(prim.slug);
    } else {
      const c = { lane: n.discipline, members: [n] }; chains.push(c); chainOf.set(n.slug, c);
    }
  }
  /* row assignment per lane: longest chains first, reserve full column span */
  const laneRows = new Map(lanes.map(l => [l, 0]));
  const occ = new Set(); const cellNode = new Map(); /* `${lane}:${r}:${c}` */
  for (const lane of lanes) {
    const lc = chains.filter(c => c.lane === lane)
      .map(c => ({ ...c, len: c.members.length, d0: Math.min(...c.members.map(m => m.depth)), d1: Math.max(...c.members.map(m => m.depth)), i0: Math.min(...c.members.map(m => m.idx)) }))
      .sort((a, b) => b.len - a.len || a.d0 - b.d0 || a.i0 - b.i0);
    for (const c of lc) {
      let r = 0;
      const free = row => { for (let d = c.d0; d <= c.d1; d++) if (occ.has(`${lane}:${row}:${d}`)) return false; return true; };
      while (!free(r)) r++;
      for (let d = c.d0; d <= c.d1; d++) occ.add(`${lane}:${r}:${d}`);
      c.members.forEach(m => { m.row = r; cellNode.set(`${lane}:${r}:${m.depth}`, m.slug); });
      laneRows.set(lane, Math.max(laneRows.get(lane), r + 1));
    }
    if (laneRows.get(lane) === 0) laneRows.set(lane, 1);
  }
  /* unlinked → first free cell in-lane (dashed); adds a row only if lane is full */
  for (const n of nodes.filter(n => !linked.has(n.slug)).sort((a, b) => a.idx - b.idx)) {
    const lane = n.discipline; let placed = false;
    for (let r = 0; r < laneRows.get(lane) && !placed; r++) for (let c = 0; c <= maxCol && !placed; c++) {
      if (!occ.has(`${lane}:${r}:${c}`)) { occ.add(`${lane}:${r}:${c}`); cellNode.set(`${lane}:${r}:${c}`, n.slug); n.row = r; n.depth = c; n.unlinked = true; placed = true; }
    }
    if (!placed) { const r = laneRows.get(lane); laneRows.set(lane, r + 1); occ.add(`${lane}:${r}:0`); cellNode.set(`${lane}:${r}:0`, n.slug); n.row = r; n.depth = 0; n.unlinked = true; }
  }
  /* geometry */
  let y = HEAD; const laneMeta = [];
  for (const lane of lanes) {
    const rows = laneRows.get(lane);
    const h = M.lanePad * 2 + (rows - 1) * M.pitch + M.nodeH;
    laneMeta.push({ lane, top: y, h, rows }); y += h;
  }
  const laneTop = new Map(laneMeta.map(l => [l.lane, l]));
  nodes.forEach(n => {
    const lm = laneTop.get(n.discipline);
    n.x = RAIL + n.depth * COL_W; n.y = lm.top + M.lanePad + n.row * M.pitch;
    n.cx = n.x + NODE_W / 2; n.cy = n.y + M.nodeH / 2; n.laneIdx = lanes.indexOf(n.discipline);
  });
  return { nodes, byId, parents, children, lanes, laneMeta, maxCol, width: RAIL + (maxCol + 1) * COL_W + 10, height: y + 8, M, cellNode };
}

/* ---- edge routing -------------------------------------------------------- */
function roundedPath(pts, r = 7) {
  if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.5) { d += ` L ${x1} ${y1}`; continue; }
    const ax = x1 - (x1 - x0) / l1 * rr, ay = y1 - (y1 - y0) / l1 * rr;
    const bx = x1 + (x2 - x1) / l2 * rr, by = y1 + (y2 - y1) / l2 * rr;
    d += ` L ${ax} ${ay} Q ${x1} ${y1} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L ${last[0]} ${last[1]}`;
}

function routeEdges(layout, reqEdges, satEdges) {
  const { byId, M, cellNode } = layout;
  const GUT = COL_W - NODE_W;
  const all = reqEdges.map(e => ({ ...e, kind: 'req' })).concat(satEdges.map(e => ({ ...e, kind: 'sat' })));
  /* entry stagger per target (left-edge entries only) */
  const inbound = new Map();
  for (const e of all) {
    const s = byId.get(e.from), t = byId.get(e.to);
    if (!s || !t) continue;
    if (e.kind === 'sat' && s.depth === t.depth) continue; /* same-col sat = vertical, no left entry */
    (inbound.get(e.to) || inbound.set(e.to, []).get(e.to)).push(e);
  }
  for (const [to, list] of inbound) {
    const t = byId.get(to);
    list.sort((a, b) => byId.get(a.from).cy - byId.get(b.from).cy || byId.get(a.from).idx - byId.get(b.from).idx);
    list.forEach((e, i) => { e.entryY = t.cy + Math.max(-M.nodeH / 2 + 5, Math.min(M.nodeH / 2 - 5, (i - (list.length - 1) / 2) * 7)); });
  }
  /* bundle bent edges into per-source trunks in the source column's gutter */
  const trunks = new Map(); /* gutterCol → Map(source → {y0,y1,edges}) */
  const routed = [];
  for (const e of all) {
    const s = byId.get(e.from), t = byId.get(e.to);
    if (!s || !t) continue;
    if (e.kind === 'sat' && s.depth === t.depth) { /* vertical equivalence link */
      const up = t.cy < s.cy;
      routed.push({ e, s, t, kind: 'sat', pts: [[s.cx, up ? s.y : s.y + M.nodeH], [t.cx, up ? t.y + M.nodeH : t.y]] });
      continue;
    }
    const ey = e.entryY ?? t.cy;
    const straight = s.laneIdx === t.laneIdx && s.row === t.row && Math.abs(ey - s.cy) < 1 && clearRow(s, t);
    if (straight) { routed.push({ e, s, t, kind: e.kind, pts: [[s.x + NODE_W, s.cy], [t.x, ey]] }); continue; }
    const g = s.depth;
    const gm = trunks.get(g) || trunks.set(g, new Map()).get(g);
    const tr = gm.get(e.from) || gm.set(e.from, { y0: s.cy, y1: s.cy, edges: [] }).get(e.from);
    tr.y0 = Math.min(tr.y0, ey, s.cy); tr.y1 = Math.max(tr.y1, ey, s.cy); tr.edges.push(e);
  }
  function clearRow(s, t) {
    for (let c = s.depth + 1; c < t.depth; c++) if (cellNode.has(`${t.discipline}:${t.row}:${c}`)) return false;
    return true;
  }
  /* gutter tracks via interval coloring */
  for (const [g, gm] of trunks) {
    const list = [...gm.values()].sort((a, b) => a.y0 - b.y0 || a.y1 - b.y1);
    const ends = [];
    for (const tr of list) {
      let k = ends.findIndex(end => end <= tr.y0 - 5);
      if (k < 0) { k = ends.length; ends.push(0); }
      ends[k] = tr.y1; tr.track = k;
    }
    const T = ends.length, spacing = Math.min(6.5, T > 1 ? (GUT - 16) / (T - 1) : 6.5);
    const colRight = RAIL + g * COL_W + NODE_W;
    for (const tr of list) {
      tr.x = colRight + 8 + tr.track * spacing;
      for (const e of tr.edges) {
        const s = byId.get(e.from), t = byId.get(e.to), ey = e.entryY ?? t.cy;
        if (clearRow(s, t)) {
          routed.push({ e, s, t, kind: e.kind, pts: [[s.x + NODE_W, s.cy], [tr.x, s.cy], [tr.x, ey], [t.x, ey]] });
        } else { /* corridor blocked (dense college mode): detour along row seam */
          const seamY = ey - M.pitch * 0.5, x2 = t.x - 12;
          routed.push({ e, s, t, kind: e.kind, pts: [[s.x + NODE_W, s.cy], [tr.x, s.cy], [tr.x, seamY], [x2, seamY], [x2, ey], [t.x, ey]] });
        }
      }
    }
  }
  return routed;
}

/* ---- component ----------------------------------------------------------- */
function truncate(s, n) { return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'; }
function wrapName(name, max) {
  if (name.length <= max) return [name];
  const words = name.split(' '); const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1], cand = cur ? cur + ' ' + w : w;
    if (cand.length <= max) lines[lines.length - 1] = cand;
    else if (lines.length < 2 && cur) lines.push(w);
    else { lines[lines.length - 1] = truncate(cand, max); break; }
  }
  return lines.slice(0, 2).map(l => truncate(l, max));
}

export default function PrereqGraph({ mode = 'canonical', concepts, rules, courses, edges, conceptIndex }) {
  const data = useMemo(() => {
    if (mode === 'college') {
      const ci = conceptIndex || {};
      const nodes = (courses || []).map(c => ({
        slug: c.key, code: `${c.prefix} ${c.number}`, name: c.title,
        discipline: (ci[c.concept] && ci[c.concept].discipline) || 'other', college: true,
      }));
      return { nodes, req: (edges || []).map(e => ({ from: e.from, to: e.to })), sat: [] };
    }
    const cs = concepts || [];
    const req = rules ? rules.map(e => ({ from: e.from, to: e.to }))
      : cs.flatMap(c => (c.requires || []).map(r => ({ from: r, to: c.slug })));
    const sat = cs.flatMap(c => (c.satisfies || []).map(s => ({ from: c.slug, to: s })));
    return { nodes: cs.map(c => ({ slug: c.slug, name: c.name, discipline: c.discipline, satisfies: c.satisfies })), req, sat };
  }, [mode, concepts, rules, courses, edges, conceptIndex]);

  const compact = data.nodes.length > 44;
  const layout = useMemo(() => computePrereqLayout(data.nodes.map(n => ({ ...n })), data.req, { compact }), [data, compact]);
  const routes = useMemo(() => routeEdges(layout, data.req, data.sat), [layout, data]);

  const [focus, setFocus] = useState(null);
  const [hover, setHover] = useState(null);
  const [kb, setKb] = useState(null);

  const chain = useMemo(() => {
    if (!focus) return null;
    const up = new Map(), down = new Map();
    const add = (m, k, v) => (m.get(k) || m.set(k, []).get(k)).push(v);
    data.req.forEach(e => { add(up, e.to, e.from); add(down, e.from, e.to); });
    data.sat.forEach(e => { add(up, e.to, e.from); add(down, e.from, e.to); add(up, e.from, e.to); add(down, e.to, e.from); });
    const walk = m => { const seen = new Set([focus]), q = [focus]; while (q.length) { const c = q.pop(); for (const nx of (m.get(c) || [])) if (!seen.has(nx)) { seen.add(nx); q.push(nx); } } return seen; };
    const anc = walk(up), desc = walk(down);
    return { set: new Set([...anc, ...desc]), up: anc.size - 1, down: desc.size - 1 };
  }, [focus, data]);

  const clear = useCallback(() => setFocus(null), []);
  const focusName = focus && layout.byId.get(focus) ? layout.byId.get(focus).name : '';
  const present = layout.lanes;
  const nf1 = compact ? 11.4 : 12.2, nf2 = compact ? 10.6 : 11.4;
  const nameMax = compact ? 22 : 20;

  return (
    <div onKeyDown={e => { if (e.key === 'Escape') clear(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'inherit' }}>
      {/* legend */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, fontSize: 11.5, color: V.inkMuted, fontWeight: 550 }}>
        {present.map(d => (
          <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: DISC[d] || DISC.other, flex: 'none' }}></span>{LANE_LABEL[d] || d}
          </span>
        ))}
        <span style={{ width: 1, height: 14, background: V.border }}></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: V.inkSubtle }}>
          <span style={{ width: 16, height: 11, borderRadius: 4, border: `1.3px dashed ${'var(--color-border-strong, #B9C0AC)'}` }}></span>no links yet
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: V.inkSubtle }}>
          <svg width="22" height="8" style={{ display: 'block' }}><line x1="1" y1="4" x2="17" y2="4" stroke={V.inkSubtle} strokeWidth="1.4" strokeDasharray="4 3" /><circle cx="19" cy="4" r="2.4" fill={V.surface} stroke={V.inkSubtle} strokeWidth="1.3" /></svg>≡ combined course (satisfies)
        </span>
        <span style={{ marginLeft: 'auto', color: V.inkSubtle, fontWeight: 450 }}>Click a node to trace its chain · Esc clears</span>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${'var(--color-border, #DFE3D8)'}`, borderRadius: 14, background: V.surface }}>
        <svg width={layout.width} height={layout.height} role="group" aria-label="Prerequisite graph: disciplines as rows, prerequisite depth as columns" style={{ display: 'block' }} onClick={clear}>
          {/* lane bands */}
          {layout.laneMeta.map((lm, i) => (
            <g key={lm.lane}>
              <rect x="0" y={lm.top} width={layout.width} height={lm.h} fill={DISC[lm.lane] || DISC.other} fillOpacity="0.038" />
              {i > 0 && <line x1="0" y1={lm.top} x2={layout.width} y2={lm.top} stroke={V.border} strokeWidth="1" strokeOpacity="0.7" />}
              <circle cx={16} cy={lm.top + lm.h / 2 - (lm.h > 60 ? 7 : 0)} r="3.6" fill={DISC[lm.lane] || DISC.other} />
              <text x={26} y={lm.top + lm.h / 2 - (lm.h > 60 ? 3.5 : -3.5)} fontSize="10" fontWeight="700" letterSpacing="0.07em" fill={V.inkMuted} style={{ textTransform: 'uppercase' }}>{(LANE_LABEL[lm.lane] || lm.lane).toUpperCase()}</text>
              {lm.h > 60 && <text x={26} y={lm.top + lm.h / 2 + 10} fontSize="10.5" fill={V.inkSubtle}>{layout.nodes.filter(n => n.discipline === lm.lane).length} concepts</text>}
            </g>
          ))}
          {/* depth header */}
          <text x={RAIL - 6} y={17} fontSize="10" fontWeight="650" letterSpacing="0.06em" fill={V.inkSubtle} textAnchor="end">DEPTH →</text>
          {Array.from({ length: layout.maxCol + 1 }, (_, c) => (
            <text key={c} x={RAIL + c * COL_W + NODE_W / 2} y={17} fontSize="10.5" fontWeight="650" fill={V.inkSubtle} textAnchor="middle">{c}</text>
          ))}

          {/* edges */}
          {routes.map((r, i) => {
            const inChain = chain && chain.set.has(r.e.from) && chain.set.has(r.e.to);
            const hovered = !chain && hover && (r.e.from === hover || r.e.to === hover);
            const sat = r.kind === 'sat';
            const color = sat ? V.inkSubtle : (DISC[r.s.discipline] || DISC.other);
            const op = chain ? (inChain ? 0.95 : 0.06) : hovered ? 0.95 : sat ? 0.55 : 0.5;
            const w = (inChain || hovered) ? 2.1 : 1.4;
            const end = r.pts[r.pts.length - 1];
            const horiz = r.pts.length > 1 && Math.abs(end[1] - r.pts[r.pts.length - 2][1]) < 0.5;
            return (
              <g key={i} opacity={op} style={{ transition: 'opacity .18s' }}>
                <title>{sat ? `${r.s.name} satisfies ${r.t.name}` : `${r.t.code || r.t.name} requires ${r.s.code || r.s.name}`}</title>
                <path d={roundedPath(r.pts)} fill="none" stroke={color} strokeWidth={w} strokeDasharray={sat ? '4 3' : 'none'} />
                {sat
                  ? <circle cx={end[0]} cy={end[1]} r="2.7" fill={V.surface} stroke={color} strokeWidth="1.4" />
                  : horiz
                    ? <path d={`M ${end[0]} ${end[1]} l -6 -3.4 v 6.8 z`} fill={color} />
                    : <path d={end[1] > r.pts[r.pts.length - 2][1] ? `M ${end[0]} ${end[1]} l -3.4 -6 h 6.8 z` : `M ${end[0]} ${end[1]} l -3.4 6 h 6.8 z`} fill={color} />}
              </g>
            );
          })}

          {/* nodes */}
          {layout.nodes.map(n => {
            const inChain = !chain || chain.set.has(n.slug);
            const isFocus = focus === n.slug;
            const color = DISC[n.discipline] || DISC.other;
            const lines = n.college ? [n.code, truncate(n.name, nameMax + 2)] : wrapName(n.name, nameMax);
            const two = lines.length > 1;
            return (
              <g key={n.slug} role="button" tabIndex={0}
                aria-pressed={isFocus}
                aria-label={`${n.code ? n.code + ' ' : ''}${n.name}, ${LANE_LABEL[n.discipline] || n.discipline}${n.unlinked ? ', no prerequisite links' : ''}`}
                onClick={e => { e.stopPropagation(); setFocus(isFocus ? null : n.slug); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setFocus(isFocus ? null : n.slug); } }}
                onMouseEnter={() => setHover(n.slug)} onMouseLeave={() => setHover(h => h === n.slug ? null : h)}
                onFocus={() => setKb(n.slug)} onBlur={() => setKb(k => k === n.slug ? null : k)}
                opacity={inChain ? 1 : 0.16} style={{ cursor: 'pointer', transition: 'opacity .18s', outline: 'none' }}>
                <title>{`${n.code ? n.code + ' — ' : ''}${n.name}${n.unlinked ? ' (no prerequisite links)' : ''}${n.satisfies && n.satisfies.length ? ' — combined: satisfies ' + n.satisfies.join(', ') : ''}`}</title>
                {isFocus && <rect x={n.x - 3} y={n.y - 3} width={NODE_W + 6} height={layout.M.nodeH + 6} rx="11" fill="none" stroke={V.accent} strokeWidth="2.5" />}
                {kb === n.slug && !isFocus && <rect x={n.x - 3} y={n.y - 3} width={NODE_W + 6} height={layout.M.nodeH + 6} rx="11" fill="none" stroke={V.accent} strokeWidth="1.6" strokeDasharray="3 3" />}
                <rect x={n.x} y={n.y} width={NODE_W} height={layout.M.nodeH} rx="8"
                  fill={V.surface}
                  stroke={isFocus ? V.primary : (chain && inChain) ? V.borderStrong : V.border}
                  strokeWidth={isFocus ? 1.6 : 1.1}
                  strokeDasharray={n.unlinked ? '3.5 3' : 'none'} />
                <rect x={n.x + 7} y={n.y + layout.M.nodeH / 2 - 7} width="3" height="14" rx="1.5" fill={color} />
                {two ? (
                  <g>
                    <text x={n.x + 17} y={n.y + layout.M.nodeH / 2 - 2.5} fontSize={n.college ? nf1 - 0.4 : nf2} fontWeight={n.college ? 700 : 570} fill={n.unlinked ? V.inkMuted : V.ink}>{lines[0]}</text>
                    <text x={n.x + 17} y={n.y + layout.M.nodeH / 2 + 9.5} fontSize={nf2 - (n.college ? 0.4 : 0)} fontWeight={n.college ? 450 : 570} fill={n.college ? V.inkMuted : n.unlinked ? V.inkMuted : V.ink}>{lines[1]}</text>
                  </g>
                ) : (
                  <text x={n.x + 17} y={n.y + layout.M.nodeH / 2 + 4} fontSize={nf1} fontWeight="570" fill={n.unlinked ? V.inkMuted : V.ink}>{lines[0]}</text>
                )}
                {n.satisfies && n.satisfies.length > 0 && <text x={n.x + NODE_W - 14} y={n.y + layout.M.nodeH / 2 + 4.5} fontSize="13" fontWeight="700" fill={color}>≡</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* focus caption — also the aria-live announcement */}
      <div aria-live="polite" style={{ minHeight: 26, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
        {focus ? (
          <React.Fragment>
            <span style={{ fontWeight: 650, color: V.ink }}>{focusName}</span>
            <span style={{ color: V.inkSubtle }}>{chain.up} upstream · {chain.down} downstream</span>
            <button onClick={clear} style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: V.inkMuted, background: V.sunken, border: 'none', borderRadius: 999, padding: '4px 12px' }}>Clear ⎋</button>
          </React.Fragment>
        ) : (
          <span style={{ color: V.inkSubtle }}>{layout.nodes.length} {mode === 'college' ? 'courses' : 'concepts'} · {data.req.length} prerequisite rules{data.sat.length ? ` · ${data.sat.length} equivalences` : ''} — full rule list in the table below</span>
        )}
      </div>
    </div>
  );
}
