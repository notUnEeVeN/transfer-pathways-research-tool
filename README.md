# Transfer Pathways Research Console

Private UC transfer-pathways research workspace over an ASSIST-derived dataset. The web app supports data browsing, agreement review, hand curation, task logs, access management, and a gallery of figures produced by teammates on their own machines.

This repo targets a dedicated research database, never the production Atlas database.

## Data Scope

The database separates source-derived and human-curated records:

- `assist_*`: institutions, complete course catalogs, selected major agreements, and admissions records copied from the source database.
- `curated_*`: manually gathered requirements, prerequisites, and course/receiver mappings.
- Team state: agreement reviews, tasks, members, API tokens, settings, and published figures.

The current source scope includes the full catalog for all 115 community colleges (100,461 courses) and all 9 UC campuses (3,903 courses). Agreements remain intentionally selected by research major; course catalogs are not filtered to computer science and are not limited to courses referenced by those agreements.

## Stable API

The permanent prefix is `/api`, with no version segment.

- Source data: `/api/assist/institutions`, `/api/assist/courses`, `/api/assist/agreements`, `/api/admissions`
- Hand-curated data: `/api/curated/requirements`, `/api/curated/prerequisites`, `/api/curated/course-categories`, `/api/curated/receiver-overrides`, `/api/curated/degrees`
- Whole-dataset reads: `/api/exports/agreements`, `/api/exports/receivers`, `/api/exports/courses`, `/api/exports/university-courses`
- Team workflows: `/api/audit/*`, `/api/tasks/*`, `/api/tokens/*`

Responses use domain names rather than MongoDB collection names. The retired root aliases are no longer served.

## Publishing Figures

Research and rendering happen locally. The server does not receive or execute Python.

```python
import matplotlib.pyplot as plt
import starter as pmt

df = pmt.get("exports/receivers")

fig, ax = plt.subplots()
df.groupby("school").size().plot.bar(ax=ax)
fig.tight_layout()

pmt.publish(
    fig,
    slug="requirements-by-campus",
    title="Requirements per UC campus",
)
```

`pmt.publish()` creates SVG, 300-dpi PNG, and PDF files on the caller's machine, then uploads only those finished files to the shared gallery. Re-publish the same slug to iterate; another teammate cannot overwrite a slug they do not own.

## Canonical Collections

The compact schema is:

```text
assist_institutions
assist_courses
assist_agreements
admissions
curated_requirements
curated_prerequisites
curated_mappings
agreement_reviews
tasks
team_members
api_tokens
settings
published_figures
```

MongoDB does not support folders for collections. The `assist_` and `curated_` prefixes provide the useful grouping, while related legacy tables are combined by domain.

## Schema Operations

The migration is copy-first and rerunnable. It stages each destination, validates counts, creates indexes and validators, then atomically renames the staged collection.

```bash
cd server
npm run schema:audit  # read-only model/count validation
npm run schema:apply  # rebuild canonical collections
```

The final cutover removed legacy routes and collections. The cleanup command is retained for restoring an old backup or converting another environment; run it only after a backup:

```bash
cd server
npm run schema:cleanup
```

## Local Setup

Server:

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Data porting runs on the admin's machine so hosted infrastructure never needs source-database credentials:

```bash
cd scripts
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
python port.py init
python port.py list "computer science"
python port.py add "computer science"
python port.py refresh-catalogs
```

Each mutating `port.py` command runs the validated canonical rebuild automatically. Source-shaped staging collections exist only during the port and are deleted after a successful rebuild.

## Verification

```bash
cd server && npm test
cd frontend && npm test -- --run
cd frontend && npm run build
```
