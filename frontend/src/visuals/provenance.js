/**
 * Provenance lanes for the Visual library.
 *
 * Every figure — a built-in analysis or a team-published figure — belongs to
 * exactly one of three source lanes:
 *
 *   ca   Ports of the older transfer-articulation research, recomputed on our data.
 *   ma   California-data recreations of the MA paper's figures.
 *   new  Original figures generated for this paper that did not exist before.
 *
 * A built-in declares its lane via `provenance` in the registry. A published
 * figure inherits the lane of the built-in it renders (interactive figures
 * resolve through `getAnalysisById`); anything without a resolvable lane —
 * including static SVG figures — falls back to `new`.
 *
 * Class names are stored as complete literals so Tailwind v4's source scan
 * emits them; never build a provenance class by interpolation at a call site.
 */
import { getAnalysisById } from '../analyses/registry'

// Display order of the lanes, top to bottom / left to right.
export const SOURCE_ORDER = ['ca', 'ma', 'new']

export const SOURCE_META = {
  ca: {
    id: 'ca',
    label: 'CA',
    name: 'CA ports',
    tagline: 'Ports of the older transfer-articulation research, on our data',
    dotClass: 'bg-prov-ca',
    textClass: 'text-prov-ca',
    softClass: 'bg-prov-ca-soft',
    borderClass: 'border-prov-ca',
  },
  ma: {
    id: 'ma',
    label: 'MA',
    name: 'MA recreations',
    tagline: 'California-data versions of the MA paper’s figures',
    dotClass: 'bg-prov-ma',
    textClass: 'text-prov-ma',
    softClass: 'bg-prov-ma-soft',
    borderClass: 'border-prov-ma',
  },
  new: {
    id: 'new',
    label: 'New',
    name: 'New for this paper',
    tagline: 'Original figures generated for this paper',
    dotClass: 'bg-prov-new',
    textClass: 'text-prov-new',
    softClass: 'bg-prov-new-soft',
    borderClass: 'border-prov-new',
  },
}

const DEFAULT_SOURCE = 'new'

// Coerce any stored value to a known lane; unknown / missing -> 'new'.
function normalizeSource(value) {
  const key = String(value || '').toLowerCase()
  return SOURCE_META[key] ? key : DEFAULT_SOURCE
}

/**
 * The provenance lane for a gallery item.
 *
 * @param item  a gallery entry ({ kind: 'analysis', analysis } | { kind: 'figure', figure }).
 * @param getAnalysis  registry lookup, injectable for tests.
 */
export function sourceForItem(item, { getAnalysis = getAnalysisById } = {}) {
  if (!item) return DEFAULT_SOURCE
  if (item.kind === 'analysis') return normalizeSource(item.analysis?.provenance)

  // Interactive publications carry a reference to the built-in they render;
  // inherit its lane. Static figures have no renderer id and fall back.
  const rendererId = item.figure?.visual?.id
  if (rendererId) {
    const analysis = getAnalysis(rendererId)
    if (analysis?.provenance) return normalizeSource(analysis.provenance)
  }
  return DEFAULT_SOURCE
}

/**
 * The source-paper figure a ported item reproduces, as a display label like
 * "CA Fig. 1" — or null for originals and derived analyses that aren't a
 * numbered port. A published copy inherits its built-in's figure number, so a
 * re-published paper figure keeps the same pill.
 */
export function figureRefForItem(item, { getAnalysis = getAnalysisById } = {}) {
  if (!item) return null
  const analysis = item.kind === 'analysis'
    ? item.analysis
    : (item.figure?.visual?.id ? getAnalysis(item.figure.visual.id) : null)
  const figureNo = analysis?.figureNo
  if (!figureNo) return null
  return `${SOURCE_META[sourceForItem(item, { getAnalysis })].label} Fig. ${figureNo}`
}

/**
 * Bucket a flat gallery into lane groups, in SOURCE_ORDER, preserving each
 * item's incoming order within its lane. Empty lanes are dropped so the page
 * never renders a headed-but-empty shelf.
 *
 * @returns Array<{ id, meta, items }>
 */
export function groupGalleryBySource(gallery, opts) {
  const buckets = new Map(SOURCE_ORDER.map((id) => [id, []]))
  for (const item of gallery || []) {
    buckets.get(sourceForItem(item, opts)).push(item)
  }
  return SOURCE_ORDER
    .map((id) => ({ id, meta: SOURCE_META[id], items: buckets.get(id) }))
    .filter((group) => group.items.length > 0)
}
