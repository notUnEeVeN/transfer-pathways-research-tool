import React, { useMemo, useRef, useState, useCallback } from 'react';
import { CA_RING, UC_CAMPUSES, DISTRICTS } from './mapData';

/**
 * California articulation coverage map — statewide, vector-only figure.
 *
 * Encoding (unchanged from the original visualization):
 *   red square    = 0–3 fully articulated UC campuses
 *   yellow circle = 4–6
 *   green diamond = 7–9
 *
 * Everything is inline SVG — no map tiles, no map-provider deps, no
 * network-loaded assets. The <svg> is the export root (data-export-root /
 * data-export-width); the hover/focus tooltip renders as an HTML overlay
 * OUTSIDE that root so it never appears in PNG/PDF output.
 *
 * Data + geometry live in ./mapData.js. Replace each district's `count` with
 * your real coverage value; do not change the bucket thresholds here.
 */

// ---- Design tokens (map to your internal-tool tokens if you have them) ----
const COLORS = { low: '#FE4F32', mid: '#FAE745', high: '#60F088' };
const INK = '#22331F';
const LAND = '#FBF8EC';
const LINE = '#AEC0B4';
const FONT = "'Hanken Grotesk', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

const W = 520;
const H = 680;
const MAP = { x: 16, y: 84, w: 488, h: 560 };
const BOX = { x: 312, y: 100, w: 192, h: 150 };
const DEG = Math.PI / 180;

const bucketOf = (c) => (c <= 3 ? 'low' : c <= 6 ? 'mid' : 'high');

function mercator(lon, lat) {
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
  return { x: lon * DEG, y: Math.max(-Math.PI, Math.min(Math.PI, y)) };
}

// Build a projection that fits `ring`'s bounding box into `rect` (uniform scale).
function makeProjection(ring, rect, pad) {
  const pts = ring.map((p) => mercator(p[0], p[1]));
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  pts.forEach((p) => {
    xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x);
    ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
  });
  const iw = rect.w - 2 * pad, ih = rect.h - 2 * pad;
  const s = Math.min(iw / (xmax - xmin), ih / (ymax - ymin));
  const ox = rect.x + pad + (iw - (xmax - xmin) * s) / 2;
  const oy = rect.y + pad + (ih - (ymax - ymin) * s) / 2;
  return (lon, lat) => {
    const m = mercator(lon, lat);
    return { x: ox + (m.x - xmin) * s, y: oy + (ymax - m.y) * s };
  };
}

function ringPath(ring, proj) {
  return ring
    .map((p, i) => {
      const q = proj(p[0], p[1]);
      return (i ? 'L' : 'M') + q.x.toFixed(2) + ' ' + q.y.toFixed(2);
    })
    .join(' ') + ' Z';
}

// The `count` nearest UC campuses — used only for the tooltip's covered list.
function coveredNames(d) {
  const cos = Math.cos(d.lat * DEG);
  return UC_CAMPUSES
    .map((u) => ({ u, dd: (u.lat - d.lat) ** 2 + ((u.lon - d.lon) * cos) ** 2 }))
    .sort((a, b) => a.dd - b.dd)
    .slice(0, d.count)
    .map((o) => o.u.name);
}

// A single coverage glyph centered at (cx, cy).
function Glyph({ bucket, cx, cy, size, strokeWidth = 1 }) {
  const common = { fill: COLORS[bucket], stroke: INK, strokeWidth, strokeLinejoin: 'round' };
  if (bucket === 'low') {
    return <rect {...common} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={1.1} />;
  }
  if (bucket === 'mid') {
    return <circle {...common} cx={cx} cy={cy} r={size * 0.56} />;
  }
  const r = size * 0.72;
  return <polygon {...common} points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} />;
}

export default function ArticulationCoverageMap({
  title = 'California articulation coverage',
  caption = 'Fully articulated UC campuses (of 9), by community college district',
  bandLabels = { low: 'Lower coverage', mid: 'Partial coverage', high: 'Full coverage' },
  showCoveredCampuses = true,
  exportFileName = 'california-articulation-coverage',
}) {
  const [active, setActive] = useState(null); // district id
  const [tip, setTip] = useState(null); // { d, x, y } in svg coords
  const svgRef = useRef(null);

  const proj = useMemo(() => makeProjection(CA_RING, MAP, 6), []);
  const caPath = useMemo(() => ringPath(CA_RING, proj), [proj]);
  const placed = useMemo(
    () => DISTRICTS.map((d) => { const q = proj(d.lon, d.lat); return { d, x: q.x, y: q.y, bucket: bucketOf(d.count) }; }),
    [proj]
  );

  const bandWord = (b) => bandLabels[b];
  const ariaLabel = (d) => `${d.name} district. ${d.count} of 9 fully articulated campuses. ${bandWord(bucketOf(d.count))}.`;

  const activate = useCallback((d, x, y) => { setActive(d.id); setTip({ d, x, y }); }, []);
  const deactivate = useCallback(() => { setActive(null); setTip(null); }, []);

  // Convert svg-space (x, y) to viewport coords for the fixed-position tooltip.
  const tipPos = () => {
    const svg = svgRef.current;
    if (!svg || !tip) return null;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return { left: r.left + (tip.x / vb.width) * r.width, top: r.top + (tip.y / vb.height) * r.height };
  };

  const exportPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const str = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const c = document.createElement('canvas');
      c.width = W * scale; c.height = H * scale;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${exportFileName}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  }, [exportFileName]);

  const legendRows = [['low', '0–3'], ['mid', '4–6'], ['high', '7–9']];
  const pos = tip ? tipPos() : null;

  return (
    <div style={{ position: 'relative', width: W, maxWidth: '100%', fontFamily: FONT, color: INK }}>
      <button
        type="button"
        onClick={exportPng}
        aria-label="Export figure as PNG"
        style={{
          position: 'absolute', top: 0, right: 0, zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '9px 15px', borderRadius: 100, border: '1px solid rgba(25,48,24,0.10)', background: '#fff',
          color: INK, fontFamily: FONT, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" />
        </svg>
        Export PNG
      </button>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        data-export-root="true"
        data-export-width={W}
        role="img"
        aria-labelledby="camap-title"
        style={{ width: W, maxWidth: '100%', height: 'auto', display: 'block', fontFamily: FONT }}
      >
        <title id="camap-title">California community college districts by number of fully articulated UC campuses</title>
        <desc>Each district is marked by a red square for 0 to 3 campuses, a yellow circle for 4 to 6, or a green diamond for 7 to 9.</desc>

        <text x={28} y={46} style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', fill: '#193018' }}>{title}</text>
        <text x={28} y={68} style={{ fontSize: 13, fill: '#6E7D6F' }}>{caption}</text>

        <path d={caPath} fill={LAND} stroke={LINE} strokeWidth={1.15} strokeLinejoin="round" />

        {placed.map(({ d, x, y, bucket }) => {
          const on = active === d.id;
          const size = 7.6 * (on ? 1.28 : 1);
          return (
            <g
              key={d.id}
              data-district-marker={d.id}
              data-bucket={bucket}
              tabIndex={0}
              role="img"
              aria-label={ariaLabel(d)}
              style={{ cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => activate(d, x, y)}
              onFocus={() => activate(d, x, y)}
              onMouseLeave={deactivate}
              onBlur={deactivate}
            >
              {on && <circle cx={x} cy={y} r={size * 0.72 + 3.5} fill="none" stroke={INK} strokeWidth={1.4} />}
              <Glyph bucket={bucket} cx={x} cy={y} size={size} strokeWidth={0.9} />
            </g>
          );
        })}

        {/* Legend, keyed inside the map's empty upper-right area */}
        <g>
          <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={12} fill="rgba(255,255,255,0.9)" stroke="rgba(25,48,24,0.12)" strokeWidth={1} />
          {legendRows.map(([bucket, range], i) => {
            const ry = BOX.y + 30 + i * 38;
            return (
              <g key={bucket}>
                <Glyph bucket={bucket} cx={BOX.x + 22} cy={ry} size={13} strokeWidth={1} />
                <text x={BOX.x + 42} y={ry - 2} style={{ fontSize: 14, fontWeight: 600, fill: '#22331F' }}>{range}</text>
                <text x={BOX.x + 42} y={ry + 14} style={{ fontSize: 11.5, fill: '#8A9A8C' }}>{bandWord(bucket)}</text>
              </g>
            );
          })}
        </g>

        <text x={28} y={H - 14} style={{ fontSize: 10.5, fill: '#98A79A' }}>
          Marker shape and fill encode the coverage band.
        </text>
      </svg>

      {/* Tooltip — HTML overlay, deliberately OUTSIDE the export root */}
      {tip && pos && (
        <div
          role="status"
          style={{
            position: 'fixed', left: pos.left, top: pos.top, transform: 'translate(-50%, calc(-100% - 16px))',
            pointerEvents: 'none', zIndex: 30, background: '#fff', borderRadius: 14,
            boxShadow: '0 8px 30px rgba(25,48,24,0.14)', border: '1px solid rgba(25,48,24,0.10)',
            padding: '12px 14px', minWidth: 182, maxWidth: 248, fontFamily: FONT,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: '#193018', lineHeight: 1.25 }}>
            {tip.d.name} district
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" style={{ flex: '0 0 auto', display: 'block' }}>
              <Glyph bucket={bucketOf(tip.d.count)} cx={7} cy={7} size={11} strokeWidth={1} />
            </svg>
            <span style={{ fontSize: 13, color: '#3a4a3a' }}>{tip.d.count} of 9 · {bandWord(bucketOf(tip.d.count))}</span>
          </div>
          {showCoveredCampuses && tip.d.count > 0 && (
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid rgba(25,48,24,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8A9A8C', marginBottom: 4 }}>
                Articulated campuses
              </div>
              <div style={{ fontSize: 12.5, color: '#3a4a3a', lineHeight: 1.45 }}>
                {coveredNames(tip.d).map((n) => `UC ${n}`).join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
