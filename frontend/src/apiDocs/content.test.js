import { describe, it, expect } from 'vitest'
import { execFileSync, execSync } from 'child_process'
import {
  ENDPOINT_GROUPS, PARTNER_ENDPOINT_GROUPS,
  GUIDE_SECTIONS, buildAiBriefing,
  STARTER_STEPS, STARTER_EXPLANATION, EXAMPLE_FIGURE_SCRIPT, EXAMPLE_PUBLISH_COMMAND,
  EXAMPLE_INTERACTIVE_PUBLISH, EXAMPLE_VARIANT_SCRIPT, STARTER_TEMPLATES,
  curlBootstrap,
} from './content'

const allEndpoints = ENDPOINT_GROUPS.flatMap((g) => g.endpoints)
const partnerEndpoints = PARTNER_ENDPOINT_GROUPS.flatMap((g) => g.endpoints)
const BLOCK_TYPES = new Set(['p', 'code', 'table', 'list'])
const PYTHON = (() => {
  try { return execSync('which python3', { encoding: 'utf8' }).trim() } catch { return null }
})()

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

  it('covers the teammate-facing source, curated, analysis, export, and spot-check surfaces', () => {
    const paths = allEndpoints.map((e) => e.path)
    expect(paths).toContain('/data/summary')
    expect(paths).toContain('/assist/institutions?kind=community_college')
    expect(paths).toContain('/curated/requirements?kind=transfer_minimum')
    expect(paths).toContain('/analysis/coverage?requirements=degree&majorContains=Computer%20Science')
    expect(paths).toContain('/analysis/credit-loss?majorContains=Computer%20Science')
    expect(paths).toContain('/exports/receivers')
    expect(paths).toContain('/audit/doc/:agreementId')
    expect(paths.some((path) => path.startsWith('/tasks'))).toBe(false)
  })

  it('publishes only the supported /api contract', () => {
    expect(PARTNER_ENDPOINT_GROUPS).toEqual(ENDPOINT_GROUPS)
    const paths = partnerEndpoints.map((e) => e.path)
    expect(paths.some((path) => path.startsWith('/analysis/'))).toBe(true)
    expect(paths.some((path) => path.startsWith('/analysis/raw'))).toBe(false)
    expect(paths.some((path) => path.startsWith('/analysis/releases'))).toBe(false)
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
    expect(EXAMPLE_INTERACTIVE_PUBLISH).toContain('visual="paper-credit-loss"')
  })

  it('offers separate single-figure and multiple-state researcher templates', () => {
    expect(STARTER_TEMPLATES.map((template) => template.id)).toEqual(['simple', 'variants'])
    expect(STARTER_TEMPLATES.map((template) => template.filename))
      .toEqual(['simple_figure.py', 'variant_figure.py'])
    expect(EXAMPLE_VARIANT_SCRIPT).toContain('variants=[')
    expect(EXAMPLE_VARIANT_SCRIPT).toContain('"state": {"version": "baseline"}')
    expect(EXAMPLE_VARIANT_SCRIPT).toContain('controls=[')
    expect(EXAMPLE_VARIANT_SCRIPT).toContain('default_variant="baseline"')
    expect(EXAMPLE_VARIANT_SCRIPT).not.toContain('requests.')
  })

  it.skipIf(!PYTHON)('keeps both downloadable templates valid Python', () => {
    for (const template of STARTER_TEMPLATES) {
      expect(() => execFileSync(
        PYTHON,
        ['-c', 'import sys; compile(sys.stdin.read(), "<starter-template>", "exec")'],
        { input: template.code, encoding: 'utf8' },
      ), template.filename).not.toThrow()
    }
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

  it('includes analysis data without the retired runner or dataset-version contract', () => {
    expect(md).toContain('/analysis/coverage')
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
    expect(md).toContain('variants=[')
    expect(md).toContain('every control key must exist in every variant state')
    expect(md).toContain('The researcher already has starter.py')
    expect(md).toContain('visual="paper-credit-loss"')
    expect(md).not.toContain('publish_script')
    expect(md).not.toContain('publish_static')
  })

  it('is deterministic', () => {
    expect(buildAiBriefing('https://api.example.test')).toBe(md)
  })
})
