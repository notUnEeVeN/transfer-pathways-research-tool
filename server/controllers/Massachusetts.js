/**
 * Massachusetts evidence baselines from two distinct vintages: literal
 * final-PDF transcriptions and the older `CurrComp Master.xlsx` repository
 * artifact. They ride beside reconstructions from recovered course-level data;
 * callers must choose a measure/source explicitly rather than calling the
 * archived workbook "published".
 */
const { asyncHandler } = require('../middleware/asyncHandler');

// The older reconciliation artifacts were generated before the final-PDF and
// archived-workbook vintages were separated. They remain useful for tracing
// the archived inputs, but their cell-level `verdict` prose must not be served
// as a verdict on the later paper. Keep the endpoint presentation-safe: lead
// with the authoritative final transcriptions and expose only summary metadata
// from the legacy diagnostics, behind an explicit evidence rule.
const pdfFigures = require('../data/ma/pdf-figures.json');
const complexityValidation = require('../data/ma/complexity-validation.json');
const legacyReconciliation = require('../data/ma/pdf-reconciliation.json');
const legacyLedgers = require('../data/ma/figure-ledgers.json');

const MA_EVIDENCE = Object.freeze({
  authority: 'Final PDF (2026, as printed)',
  evidence_rule: 'A mismatch with the 2024 archived repository or an archived-sheet reconstruction establishes version divergence, not a final-paper error. A paper error requires an internal final-PDF arithmetic, population, or scope contradiction.',
  final_pdf: pdfFigures,
  complexity: complexityValidation,
  archived_diagnostics: {
    caution: 'Legacy diagnostic labels were written before source vintages were separated. They describe the 2024 archive and must not be quoted as final-paper verdicts.',
    reconciliation: {
      generated_at: legacyReconciliation.generated_at,
      summary: {
        pairs: legacyReconciliation.summary?.pairs,
        mean_archived_reconstruction: legacyReconciliation.summary?.mean_ours,
        mean_final_pdf: legacyReconciliation.summary?.mean_pdf,
      },
      artifact: 'server/data/ma/pdf-reconciliation.json',
    },
    figure_ledgers: {
      generated_at: legacyLedgers.generated_at,
      fig1: legacyLedgers.fig1,
      artifact: 'server/data/ma/figure-ledgers.json',
    },
  },
});

async function baselinesData(db) {
  const rows = await db.collection('ma_paper_baselines').find({}).toArray();
  const measures = {};
  for (const row of rows) {
    if (!measures[row.measure]) measures[row.measure] = { resident: [], cells: [] };
    const target = row.community_college_id == null ? 'resident' : 'cells';
    measures[row.measure][target].push({
      school_id: row.school_id,
      school: row.school,
      community_college_id: row.community_college_id,
      college_name: row.college_name ?? null,
      value: row.value,
    });
  }
  return {
    measures,
    source: 'Final-PDF figure transcriptions plus archived CurrComp Master.xlsx; see server/data/ma/PROVENANCE.md',
    sources: {
      final_pdf: 'server/data/ma/pdf-figures.json (literal final-PDF transcription)',
      archived_repo: 'CurrComp Master.xlsx (older repository artifact)',
    },
  };
}

exports.baselinesData = baselinesData;

function evidenceData() {
  return MA_EVIDENCE;
}

exports.evidenceData = evidenceData;

exports.baselines = asyncHandler(async (req, res) => {
  res.json(await baselinesData(req.app.locals.db));
});

exports.evidence = asyncHandler(async (req, res) => res.json(evidenceData()));
