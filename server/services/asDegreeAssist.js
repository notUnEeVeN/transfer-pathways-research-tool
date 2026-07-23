/**
 * AI-assisted structural editing for one canonical AS-degree record.
 *
 * This service is intentionally read-only: Claude proposes a complete document,
 * the normal canonical validator checks it, and the caller decides whether to
 * submit it through PUT /curated/requirements/as_degree.
 */
const MODEL = 'claude-opus-4-8';
const REQUIREMENTS = 'curated_requirements';
const COURSES = 'assist_courses';
const { recomputeAsDegreeCoveredConcepts } = require('./asDegreeConcepts');

const AI_EDITABLE_DOC_FIELDS = new Set([
  'status',
  'degree_title_seen',
  'catalog_url',
  'catalog_year',
  'unit_system',
  'total_units',
  'requirement_groups',
]);

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['proposed_doc', 'changes'],
  properties: {
    // Anthropic structured outputs require every object schema to enumerate
    // its properties and reject extras. The canonical document intentionally
    // carries extensible provenance, so transport it as JSON inside the strict
    // envelope and parse it back before applying our canonical invariants.
    proposed_doc: {
      type: 'string',
      description: 'JSON.stringify of the complete proposed canonical as_degree document.',
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['group_id', 'kind', 'summary'],
        properties: {
          group_id: { type: 'string' },
          kind: { type: 'string', enum: ['edit', 'add', 'remove', 'doc_field'] },
          summary: { type: 'string' },
        },
      },
    },
  },
};

function canonicalRecordId(recordId) {
  const decoded = decodeURIComponent(String(recordId || '').trim());
  if (!decoded) throw new Error('record id is required');
  return decoded.startsWith('as_degree:') ? decoded : `as_degree:${decoded}`;
}

function systemPrompt(courseLines, templateJson) {
  return [
    'You correct AS-degree requirement documents for a transfer-pathways research database.',
    'Return the COMPLETE corrected document as a JSON-encoded string in proposed_doc.',
    'Preserve every field you are not changing byte-for-byte.',
    'The proposed_doc must retain the current _id, legacy_id, college, degree type, and major identity.',
    'Only status, degree_title_seen, catalog_url, catalog_year, unit_system, total_units, and requirement_groups are editable.',
    'Never change or omit template_ref, verification, covered_concepts, extraction, source, timestamps, or provenance fields.',
    'Hard rules (server-validated):',
    "- every requirement group you touch or add must have source 'curated' and confidence null;",
    "- reordering groups touches every group whose relative position changes; those groups must also use source 'curated' and confidence null;",
    '- group_id values match ^[a-z0-9_]+$ and are unique;',
    "- a doc whose status is not 'found' must not carry requirement_groups;",
    '- course references may only use the numeric course ids from the catalog list below;',
    "- course_keys must mirror course_ids as 'cc:<numeric id>';",
    '- never invent, rewrite, or remove verification notes or any user-authored prose note field;',
    'College course catalog (id | code | title | units | concept):',
    courseLines || '(no course rows found)',
    templateJson ? `Statewide template for this degree type:\n${templateJson}` : '',
  ].filter(Boolean).join('\n');
}

function readStructuredResponse(response) {
  if (response?.stop_reason === 'refusal') {
    throw new Error('The assistant declined this instruction; rephrase and try again.');
  }
  if (response?.stop_reason === 'max_tokens') {
    throw new Error('The assistant response was too long; narrow the instruction and try again.');
  }
  const text = response?.content?.find((block) => block?.type === 'text')?.text;
  if (!text) throw new Error('The assistant returned no structured proposal.');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The assistant returned invalid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.proposed_doc !== 'string'
      || !Array.isArray(parsed.changes)) {
    throw new Error('The assistant response did not include a proposed_doc JSON string and changes array.');
  }
  let proposedDoc;
  try {
    proposedDoc = JSON.parse(parsed.proposed_doc);
  } catch {
    throw new Error('The assistant returned invalid proposed_doc JSON.');
  }
  if (!proposedDoc || typeof proposedDoc !== 'object' || Array.isArray(proposedDoc)) {
    throw new Error('The assistant proposed_doc must decode to an object.');
  }
  for (const change of parsed.changes) {
    if (!change || typeof change.group_id !== 'string' || typeof change.summary !== 'string'
        || !['edit', 'add', 'remove', 'doc_field'].includes(String(change.kind).toLowerCase())) {
      throw new Error('The assistant returned an invalid change summary.');
    }
    change.kind = String(change.kind).toLowerCase();
  }
  return { ...parsed, proposed_doc: proposedDoc };
}

async function callModel(anthropic, system, userText) {
  if (!anthropic?.messages?.create) throw new Error('AI assist client is unavailable.');
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [{ role: 'user', content: userText }],
  });
  return readStructuredResponse(response);
}

function sameJson(left, right) {
  const normalize = (value) => {
    // JSON.stringify applies Date/ObjectId toJSON semantics before this parse;
    // recursively sorting the resulting plain-object keys makes comparison
    // semantic without changing array order (which is structurally relevant).
    const json = JSON.stringify(value ?? null);
    const sortKeys = (entry) => {
      if (Array.isArray(entry)) return entry.map(sortKeys);
      if (!entry || typeof entry !== 'object') return entry;
      return Object.fromEntries(Object.keys(entry).sort()
        .map((key) => [key, sortKeys(entry[key])]));
    };
    return JSON.stringify(sortKeys(JSON.parse(json)));
  };
  return normalize(left) === normalize(right);
}

function sameStoredField(current, proposed, field) {
  const currentHas = Object.prototype.hasOwnProperty.call(current, field);
  const proposedHas = Object.prototype.hasOwnProperty.call(proposed, field);
  return currentHas === proposedHas && (!currentHas || sameJson(current[field], proposed[field]));
}

function proposalInvariantError(current, proposed, allowedCourseIds = null) {
  const allFields = new Set([...Object.keys(current || {}), ...Object.keys(proposed || {})]);
  for (const field of allFields) {
    if (AI_EDITABLE_DOC_FIELDS.has(field) || sameStoredField(current, proposed, field)) continue;
    if (field === 'verification') {
      return 'verification notes and status are user-authored and cannot be changed by AI assist';
    }
    return `${field} cannot be changed or omitted by AI assist`;
  }

  const currentGroups = Array.isArray(current.requirement_groups) ? current.requirement_groups : [];
  const proposedGroups = Array.isArray(proposed.requirement_groups) ? proposed.requirement_groups : [];
  const before = new Map(currentGroups.map((group) => [group.group_id, group]));
  const afterIds = new Set(proposedGroups.map((group) => group?.group_id));
  const beforeIds = new Set(currentGroups.map((group) => group?.group_id));
  const priorCommonOrder = currentGroups.map((group) => group?.group_id)
    .filter((groupId) => afterIds.has(groupId));
  const nextCommonOrder = proposedGroups.map((group) => group?.group_id)
    .filter((groupId) => beforeIds.has(groupId));
  const reorderedIds = new Set(nextCommonOrder.filter(
    (groupId, index) => priorCommonOrder[index] !== groupId,
  ));

  for (const group of proposedGroups) {
    const previous = before.get(group?.group_id);
    if (!previous || reorderedIds.has(group?.group_id) || !sameJson(previous, group)) {
      if (group?.source !== 'curated' || group?.confidence != null) {
        return `group ${group?.group_id || '(missing id)'}: changed groups must use source 'curated' and confidence null`;
      }
      if (allowedCourseIds) {
        for (const section of group.sections || []) {
          for (const receiver of section.receivers || []) {
            for (const option of receiver.options || []) {
              for (const id of option.course_ids || []) {
                if (!allowedCourseIds.has(id)) {
                  return `group ${group.group_id}: course id ${id} is not in this college's catalog`;
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function courseCatalogLine(course) {
  const code = [course.prefix, course.number].filter(Boolean).join(' ').trim() || '(no code)';
  return `${course.course_id} | ${code} | ${course.title || ''} | ${course.units ?? ''} | ${course.concept || ''}`;
}

async function loadContext(db, recordId) {
  const current = await db.collection(REQUIREMENTS).findOne({ _id: canonicalRecordId(recordId) });
  if (!current || current.kind !== 'as_degree') throw new Error('AS-degree record not found.');
  const [courses, template] = await Promise.all([
    db.collection(COURSES)
      .find(
        { institution_id: current.college_id },
        { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, concept: 1 } },
      )
      .sort({ prefix: 1, number: 1 })
      .toArray(),
    current.template_ref
      ? db.collection(REQUIREMENTS).findOne({ _id: current.template_ref })
      : Promise.resolve(null),
  ]);
  return { current, courses, template };
}

async function proposalError(db, current, candidate, validate, allowedCourseIds, courses) {
  const invariant = proposalInvariantError(current, candidate.proposed_doc, allowedCourseIds);
  if (invariant) return invariant;
  candidate.proposed_doc.covered_concepts = await recomputeAsDegreeCoveredConcepts(
    db,
    candidate.proposed_doc,
    { courses },
  );
  const invalid = await validate(db, candidate.proposed_doc);
  return invalid || null;
}

async function proposeAsDegreeEdit(db, { recordId, instruction }, { anthropic, validate }) {
  const cleanInstruction = String(instruction || '').trim();
  if (!cleanInstruction) throw new Error('instruction is required');
  if (typeof validate !== 'function') throw new Error('AS-degree validator is unavailable.');

  const { current, courses, template } = await loadContext(db, recordId);
  current.covered_concepts = await recomputeAsDegreeCoveredConcepts(db, current, { courses });
  const allowedCourseIds = new Set(courses.map((course) => Number(course.course_id)));
  const system = systemPrompt(
    courses.map(courseCatalogLine).join('\n'),
    template ? JSON.stringify(template, null, 2) : '',
  );
  const baseUserText = [
    'Current canonical AS-degree document:',
    JSON.stringify(current, null, 2),
    'Requested correction:',
    cleanInstruction,
  ].join('\n\n');

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userText = attempt === 0
      ? baseUserText
      : `${baseUserText}\n\nYour previous proposal was rejected by the canonical validator:\n${lastError}\nReturn a corrected complete proposal.`;
    let candidate;
    try {
      candidate = await callModel(anthropic, system, userText);
    } catch (error) {
      // A refusal is a deliberate response and should be shown immediately.
      if (/declined/i.test(error.message)) throw error;
      lastError = error.message;
      if (attempt === 1) throw new Error(lastError);
      continue;
    }
    lastError = await proposalError(db, current, candidate, validate, allowedCourseIds, courses);
    if (!lastError) return candidate;
    if (attempt === 1) throw new Error(`The proposed edit did not pass validation: ${lastError}`);
  }
  throw new Error(lastError || 'The assistant could not produce a valid proposal.');
}

module.exports = {
  proposeAsDegreeEdit,
  _RESPONSE_SCHEMA: RESPONSE_SCHEMA,
  _proposalInvariantError: proposalInvariantError,
};
