import { describe, it, expect } from 'vitest'
import {
  ENDPOINT_GROUPS, PARTNER_ENDPOINT_GROUPS,
  GUIDE_SECTIONS, buildAiBriefing,
  STARTER_STEPS, STARTER_EXPLANATION, EXAMPLE_FIGURE_SCRIPT, EXAMPLE_PUBLISH_COMMAND, curlBootstrap,
} from './content'

const allEndpoints = ENDPOINT_GROUPS.flatMap((g) => g.endpoints)
const partnerEndpoints = PARTNER_ENDPOINT_GROUPS.flatMap((g) => g.endpoints)
const BLOCK_TYPES = new Set(['p', 'code', 'table', 'list'])

describe('ENDPOINT_GROUPS content invariants', () => {
  it('has groups with ids, titles and endpoints', () => {
    expect(ENDPOINT_GROUPS.length).toBeGreaterThanOrEqual(3)
    for (const g of ENDPOINT_GROUPS) {
      expect(g.id).toBeTruthy()
      expect(g.title).toBeTruthy()
      expect(g.endpoints.length).toBeGreaterThan(0)
    }
  })

  it('every endpoint carries a real plain-English explanation, not a stub', () => {
    for (const e of allEndpoints) {
      expect(e.path.startsWith('/'), e.path).toBe(true)
      expect(e.title, e.path).toBeTruthy()
      // "what you get & why it matters" must be a sentence-level explanation
      expect(e.plain.length, `plain too short for ${e.path}`).toBeGreaterThan(30)
    }
  })

  it('covers the teammate-facing source, curated, export, and spot-check surfaces', () => {
    const paths = allEndpoints.map((e) => e.path)
    expect(paths).toContain('/data/summary')
    expect(paths).toContain('/assist/institutions?kind=community_college')
    expect(paths).toContain('/curated/requirements?kind=transfer_minimum')
    expect(paths).toContain('/exports/receivers')
    expect(paths).toContain('/audit/doc/:agreementId')
    expect(paths.some((path) => path.startsWith('/tasks'))).toBe(false)
  })

  it('publishes only the permanent /api contract', () => {
    expect(PARTNER_ENDPOINT_GROUPS).toEqual(ENDPOINT_GROUPS)
    const paths = partnerEndpoints.map((e) => e.path)
    expect(paths.some((path) => path.startsWith('/analysis'))).toBe(false)
    expect(paths.some((path) => path.startsWith('/figures'))).toBe(false)
    expect(paths.some((path) => path.startsWith('/references'))).toBe(false)
    expect(paths.some((path) => path.startsWith('/curation/ref'))).toBe(false)
  })
})

describe('starter + publish content', () => {
  it('has getting-started steps and a starter explanation', () => {
    expect(STARTER_STEPS.length).toBeGreaterThanOrEqual(3)
    for (const [t, d] of STARTER_STEPS) { expect(t).toBeTruthy(); expect(d).toBeTruthy() }
    expect(STARTER_EXPLANATION.length).toBeGreaterThan(60)
  })

  it('the worked example gets data and publishes a locally rendered figure', () => {
    expect(EXAMPLE_FIGURE_SCRIPT).toContain('pmt.get(')
    expect(EXAMPLE_FIGURE_SCRIPT).not.toContain('pmt.fetch(')
    expect(EXAMPLE_FIGURE_SCRIPT).toContain('pmt.publish(fig')
    expect(EXAMPLE_PUBLISH_COMMAND).toContain('pmt.publish(fig')
  })

  it('keeps the starter docs to a single public publish method', () => {
    const starter = [STARTER_EXPLANATION, ...STARTER_STEPS.flat()].join('\n')
    expect(starter).not.toContain('publish_script')
    expect(starter).not.toContain('publish_static')
  })

  it('bootstrap curl bakes in the base url', () => {
    expect(curlBootstrap('https://x.test/api')).toContain('https://x.test/api/client.py')
    expect(curlBootstrap('https://x.test')).toContain('-o starter.py')
  })
})

describe('GUIDE_SECTIONS content invariants', () => {
  it('sections have titles and only known block types', () => {
    expect(GUIDE_SECTIONS.length).toBeGreaterThanOrEqual(4)
    for (const s of GUIDE_SECTIONS) {
      expect(s.title).toBeTruthy()
      expect(s.blocks.length).toBeGreaterThan(0)
      for (const b of s.blocks) expect(BLOCK_TYPES.has(b.type), `${s.title}: ${b.type}`).toBe(true)
    }
  })
})

describe('buildAiBriefing', () => {
  const md = buildAiBriefing('https://api.example.test')

  it('bakes in the base URL and auth header', () => {
    expect(md).toContain('https://api.example.test')
    expect(md).toContain('Authorization: Bearer')
  })

  it('includes every partner-facing endpoint with its explanation', () => {
    for (const e of partnerEndpoints) {
      expect(md).toContain(e.path)
      expect(md).toContain(e.plain)
    }
  })

  it('contains no retired analysis runner or dataset-version contract', () => {
    expect(md).not.toContain('/analysis/')
    expect(md).not.toContain('/figure-scripts')
    expect(md).not.toContain('dataset_version')
    expect(md).toContain('No Python code runs on the server')
  })

  it('includes every guide section', () => {
    for (const s of GUIDE_SECTIONS) expect(md).toContain(s.title)
  })

  it('teaches the AI the publish workflow', () => {
    expect(md).toContain('pmt.publish')
    expect(md).toContain('pmt.publish(fig')
    expect(md).not.toContain('publish_script')
    expect(md).not.toContain('publish_static')
  })

  it('is deterministic', () => {
    expect(buildAiBriefing('https://api.example.test')).toBe(md)
  })
})
