import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const {
  proposeAsDegreeEdit,
  _RESPONSE_SCHEMA,
  _proposalInvariantError,
} = cjs('./asDegreeAssist');

const CURRENT_DOC = {
  _id: 'as_degree:110:ast',
  legacy_id: '110:ast',
  kind: 'as_degree',
  community_college_id: 110,
  college_id: 'cc:110',
  degree_type: 'ast',
  major_slug: 'cs',
  template_ref: 'as_degree_template:cs_ast',
  status: 'found',
  degree_title_seen: 'Computer Science, A.S.-T.',
  catalog_url: 'https://catalog.example.edu/cs-ast',
  catalog_year: '2025-2026',
  unit_system: 'semester',
  total_units: 60,
  covered_concepts: ['cs_1'],
  verification: { verified: false, notes: 'Partner-authored note' },
  extraction: { artifact: 'as_degrees_cs_extraction.json', confidence: 0.91 },
  source: 'as_degrees_cs_extraction.json',
  updated_at: '2026-07-20T00:00:00.000Z',
  requirement_groups: [{
    group_id: 'core',
    template_group: 'core',
    label_seen: 'Required core',
    source: 'extracted',
    confidence: 0.91,
    ge_area: null,
    units_fill: false,
    sections: [{
      section_advisement: null,
      unit_advisement: null,
      receivers: [{
        receiving: null,
        articulation_status: 'articulated',
        options: [{ course_ids: [101], course_keys: ['cc:101'], course_conjunction: 'and' }],
        options_conjunction: 'and',
      }],
    }],
    unresolved_courses_seen: [],
  }],
};

function proposal(overrides = {}) {
  return {
    proposed_doc: {
      ...structuredClone(CURRENT_DOC),
      requirement_groups: [{
        ...structuredClone(CURRENT_DOC.requirement_groups[0]),
        label_seen: 'Core requirements',
        source: 'curated',
        confidence: null,
      }],
      ...overrides,
    },
    changes: [{ group_id: 'core', kind: 'edit', summary: 'Renamed the core group.' }],
  };
}

function fakeDb() {
  const docs = {
    'as_degree:110:ast': CURRENT_DOC,
    'as_degree_template:cs_ast': { _id: 'as_degree_template:cs_ast', kind: 'as_degree_template', groups: [] },
  };
  return {
    collection(name) {
      if (name === 'curated_requirements') {
        return {
          findOne: vi.fn(async (filter) => structuredClone(docs[filter._id] || null)),
          replaceOne: vi.fn(() => { throw new Error('assist must not write'); }),
        };
      }
      if (name === 'assist_courses') {
        return {
          find: vi.fn(() => ({
            sort() { return this; },
            async toArray() {
              return [
                {
                  _id: 'cc:101', course_id: 101, institution_id: 'cc:110',
                  prefix: 'CS', number: '101', title: 'Programming I', units: 4, concept: 'cs_1',
                },
                {
                  _id: 'cc:102', course_id: 102, institution_id: 'cc:110',
                  prefix: 'MATH', number: '200', title: 'Discrete Mathematics', units: 3,
                  concept: 'discrete_math',
                },
              ];
            },
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };
}

function anthropicReturning(payloads) {
  const create = vi.fn();
  for (const payload of payloads) {
    const wirePayload = payload?.proposed_doc && typeof payload.proposed_doc === 'object'
      ? { ...payload, proposed_doc: JSON.stringify(payload.proposed_doc) }
      : payload;
    const response = payload?.content
      ? payload
      : { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(wirePayload) }] };
    create.mockResolvedValueOnce(response);
  }
  return { messages: { create } };
}

describe('AS-degree AI assist', () => {
  it('uses an Anthropic-compatible strict envelope and parses proposed_doc JSON', () => {
    const visit = (schema) => {
      if (!schema || typeof schema !== 'object') return;
      if (schema.type === 'object') {
        expect(schema.additionalProperties).toBe(false);
        Object.values(schema.properties || {}).forEach(visit);
      }
      if (schema.type === 'array') visit(schema.items);
    };

    visit(_RESPONSE_SCHEMA);
    expect(_RESPONSE_SCHEMA.properties.proposed_doc.type).toBe('string');
  });

  it('returns a validated proposal without saving', async () => {
    const anthropic = anthropicReturning([proposal()]);
    const validate = vi.fn().mockResolvedValue(null);

    const result = await proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Rename the core group.' },
      { anthropic, validate },
    );

    expect(result).toEqual(proposal());
    expect(validate).toHaveBeenCalledWith(expect.anything(), result.proposed_doc);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(anthropic.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-opus-4-8',
      output_config: { format: { type: 'json_schema', schema: _RESPONSE_SCHEMA } },
    }));
  });

  it('retries malformed proposed_doc JSON once', async () => {
    const invalidWireResponse = {
      stop_reason: 'end_turn',
      content: [{
        type: 'text',
        text: JSON.stringify({ proposed_doc: '{not-json', changes: [] }),
      }],
    };
    const anthropic = anthropicReturning([invalidWireResponse, proposal()]);

    await expect(proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Rename the core group.' },
      { anthropic, validate: vi.fn().mockResolvedValue(null) },
    )).resolves.toEqual(proposal());
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
    expect(anthropic.messages.create.mock.calls[1][0].messages[0].content)
      .toContain('invalid proposed_doc JSON');
  });

  it('retries once with the validation failure, then succeeds', async () => {
    const first = proposal();
    first.proposed_doc.requirement_groups[0].source = 'extracted';
    first.proposed_doc.requirement_groups[0].confidence = 0.9;
    const second = proposal();
    const anthropic = anthropicReturning([first, second]);
    const validate = vi.fn().mockResolvedValue(null);

    const result = await proposeAsDegreeEdit(
      fakeDb(),
      { recordId: '110:ast', instruction: 'Fix the core group.' },
      { anthropic, validate },
    );

    expect(result).toEqual(second);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
    expect(anthropic.messages.create.mock.calls[1][0].messages[0].content)
      .toContain("must use source 'curated'");
  });

  it('rejects with a readable reason when both proposals fail validation', async () => {
    const anthropic = anthropicReturning([proposal(), proposal()]);
    const validate = vi.fn().mockResolvedValue('group core: option course_ids are invalid');

    await expect(proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Change the courses.' },
      { anthropic, validate },
    )).rejects.toThrow(/option course_ids are invalid/);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
  });

  it('surfaces a refusal without retrying', async () => {
    const anthropic = anthropicReturning([{
      stop_reason: 'refusal',
      content: [{ type: 'text', text: 'No.' }],
    }]);

    await expect(proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Make a change.' },
      { anthropic, validate: vi.fn() },
    )).rejects.toThrow(/assistant declined/i);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
  });

  it('does not allow the proposal to change identity or user-authored verification notes', async () => {
    const wrongId = proposal({ _id: 'as_degree:999:ast' });
    const changedNotes = proposal({ verification: { verified: false, notes: 'AI-authored note' } });
    const anthropic = anthropicReturning([wrongId, changedNotes]);

    await expect(proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Make a change.' },
      { anthropic, validate: vi.fn().mockResolvedValue(null) },
    )).rejects.toThrow(/verification notes/i);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
  });

  it('does not let AI mark a record verified', async () => {
    const verified = proposal({
      verification: { verified: true, verified_by: 'ai', verified_at: 'now', notes: 'Partner-authored note' },
    });
    const anthropic = anthropicReturning([verified, verified]);

    await expect(proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Mark this verified.' },
      { anthropic, validate: vi.fn().mockResolvedValue(null) },
    )).rejects.toThrow(/verification notes and status are user-authored/i);
  });

  it('protects template identity, extraction metadata, source, and unknown fields', () => {
    const changedTemplate = proposal({ template_ref: null }).proposed_doc;
    expect(_proposalInvariantError(CURRENT_DOC, changedTemplate, new Set([101])))
      .toMatch(/template_ref cannot be changed or omitted/);

    const missingExtraction = proposal().proposed_doc;
    delete missingExtraction.extraction;
    expect(_proposalInvariantError(CURRENT_DOC, missingExtraction, new Set([101])))
      .toMatch(/extraction cannot be changed or omitted/);

    const changedSource = proposal({ source: 'model-generated' }).proposed_doc;
    expect(_proposalInvariantError(CURRENT_DOC, changedSource, new Set([101])))
      .toMatch(/source cannot be changed or omitted/);

    const changedCoverage = proposal({ covered_concepts: ['calc_3'] }).proposed_doc;
    expect(_proposalInvariantError(CURRENT_DOC, changedCoverage, new Set([101])))
      .toMatch(/covered_concepts cannot be changed or omitted/);

    const addedField = proposal({ model_commentary: 'trust me' }).proposed_doc;
    expect(_proposalInvariantError(CURRENT_DOC, addedField, new Set([101])))
      .toMatch(/model_commentary cannot be changed or omitted/);
  });

  it('compares immutable nested objects semantically rather than by JSON key order', () => {
    const reorderedKeys = proposal().proposed_doc;
    reorderedKeys.verification = {
      notes: CURRENT_DOC.verification.notes,
      verified: CURRENT_DOC.verification.verified,
    };
    reorderedKeys.extraction = {
      confidence: CURRENT_DOC.extraction.confidence,
      artifact: CURRENT_DOC.extraction.artifact,
    };

    expect(_proposalInvariantError(CURRENT_DOC, reorderedKeys, new Set([101]))).toBeNull();
  });

  it('treats relative group reordering as an edit requiring curated provenance', () => {
    const second = {
      ...structuredClone(CURRENT_DOC.requirement_groups[0]),
      group_id: 'mathematics',
      template_group: 'mathematics',
      label_seen: 'Mathematics',
    };
    const current = {
      ...structuredClone(CURRENT_DOC),
      requirement_groups: [structuredClone(CURRENT_DOC.requirement_groups[0]), second],
    };
    const reordered = {
      ...structuredClone(current),
      requirement_groups: [structuredClone(second), structuredClone(current.requirement_groups[0])],
    };

    expect(_proposalInvariantError(current, reordered, new Set([101])))
      .toMatch(/changed groups must use source 'curated'/);
    for (const group of reordered.requirement_groups) {
      group.source = 'curated';
      group.confidence = null;
    }
    expect(_proposalInvariantError(current, reordered, new Set([101]))).toBeNull();
  });

  it('returns authoritative covered_concepts after a proposed course edit', async () => {
    const changedCourse = proposal();
    changedCourse.proposed_doc.requirement_groups[0]
      .sections[0].receivers[0].options[0] = {
        course_ids: [102], course_keys: ['cc:102'], course_conjunction: 'and',
      };

    const result = await proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Use discrete mathematics.' },
      { anthropic: anthropicReturning([changedCourse]), validate: vi.fn().mockResolvedValue(null) },
    );

    expect(result.proposed_doc.covered_concepts).toEqual(['discrete_math']);
  });

  it('rejects course ids outside the selected college catalog', async () => {
    const unknownCourse = proposal();
    unknownCourse.proposed_doc.requirement_groups[0]
      .sections[0].receivers[0].options[0] = {
        course_ids: [999], course_keys: ['cc:999'], course_conjunction: 'and',
      };
    const anthropic = anthropicReturning([unknownCourse, unknownCourse]);

    await expect(proposeAsDegreeEdit(
      fakeDb(),
      { recordId: 'as_degree:110:ast', instruction: 'Use another course.' },
      { anthropic, validate: vi.fn().mockResolvedValue(null) },
    )).rejects.toThrow(/not in this college's catalog/);
  });
});
