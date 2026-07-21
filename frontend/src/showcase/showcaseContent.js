/**
 * Frozen editorial content for the first read-only research showcase.
 *
 * The headline values deliberately do not come from the signed-in viewer's
 * live API scope. That keeps a weekly presentation stable and auditable. The
 * full visuals opened from the showcase remain live, and are labeled as such.
 */

export const SHOWCASE_SNAPSHOT = {
  compiledOn: 'July 20, 2026',
  assistRefreshedOn: 'July 11, 2026',
  label: 'Working research snapshot',
}

export const SCOPE_METRICS = [
  { value: '115', label: 'California community colleges' },
  { value: '9', label: 'University of California campuses' },
  { value: '2,415', label: 'transfer agreements in the source corpus' },
  { value: '114', label: 'colleges with an analyzable computing degree' },
]

export const SHOWCASE_FINDINGS = [
  {
    id: 'complete-paths',
    analysisId: 'category-gaps',
    status: 'Working finding',
    metric: '5 of 9',
    title: 'A typical district has complete paths to five of nine UC computer science programs',
    description: 'Current ASSIST requirements produce 356 complete district and campus paths out of 648. Twenty three districts reach all seven campuses that have any complete path. Gaps in three course requirements close UCLA and UC San Diego statewide.',
    question: 'How many selected UC computer science programs can a student fully prepare for within each community college district?',
    scope: '72 districts and 9 selected programs',
    method: 'Uses each selected program’s current required ASSIST groups and counts a district as complete when its member colleges collectively cover every required group.',
    preview: 'complete-paths',
    actionLabel: 'Explore the course gaps behind this finding',
    liveNote: 'The related live view groups missing articulation by course category. It explains the blockers behind this finding rather than recreating the frozen district count.',
  },
  {
    id: 'transferable-coverage',
    analysisId: 'coverage-heatmap',
    status: 'Working finding',
    metric: '74.6%',
    title: 'Community colleges cover three quarters of UC course requirements meant for transfer',
    description: 'Community colleges cover 11,751 of 15,755 transferable course slots across the selected UC graduation plans. When breadth and university resident work are also counted, 47.1% of all modeled slots can be completed before transfer.',
    question: 'How much of a UC computer science graduation plan is designed for course transfer, and how much of that work has a community college equivalent?',
    scope: '1,035 college and campus pairs',
    method: 'Counts course requirements marked transferable separately from breadth and requirements that the UC model expects students to complete after transfer.',
    preview: 'requirement-coverage',
    actionLabel: 'Explore graduation coverage by college',
    liveNote: 'The related live heatmap opens on all modeled graduation requirements. The 74.6% showcase value isolates course requirements meant for transfer.',
  },
  {
    id: 'paired-degrees',
    analysisId: 'transfer-credit-rate',
    status: 'Working finding',
    metric: '9.5 points',
    title: 'The transfer degree aligns better at the same colleges',
    description: 'Among 21 semester system colleges with both degree types, the modeled credit rate is 66.3% for the Computer Science Associate Degree for Transfer and 56.8% for the local Computer Science associate degree.',
    question: 'When a college offers both degrees, how much of each one counts toward the same nine UC graduation plans?',
    scope: '21 matched colleges and 9 UC campuses',
    method: 'Keeps the college set and unit system fixed, then applies the same articulation and graduation requirement model to both degree types.',
    preview: 'paired-degrees',
    actionLabel: 'Explore degree credit by college',
    liveNote: 'The related live view shows the full local and transfer degree cohorts. The 21 college semester comparison is a prepared matched slice, so its values do not appear as the default live filter.',
  },
]

export const DEGREE_COMPARISON = [
  {
    label: 'Local computer science associate degree',
    colleges: 'The same 21 semester system colleges',
    creditRate: '56.8%',
    extraUnits: '+25.8',
  },
  {
    label: 'Computer science Associate Degree for Transfer',
    colleges: 'The same 21 semester system colleges',
    creditRate: '66.3%',
    extraUnits: '+16.6',
  },
]

export const LIMITATIONS = [
  'Degree estimates remain provisional while direct source record review continues.',
  'District completeness reflects the combined offerings of member colleges, not a promise that one college offers the entire path.',
  'Some general education credit uses an explicit optimal student assumption when a verified transfer pattern is not available.',
  'The denominator counts prescribed degree units, not every elective a student could take.',
  'Quarter and semester unit results are kept separate in the matched comparison.',
  'Additional units are a modeled burden, not observed student time to degree.',
]

export const WEDNESDAY_QUESTIONS = [
  'How did the original team treat course series, partial articulations, and requirements that cross groups?',
  'Which requirement source did they consider authoritative when university websites and ASSIST differed?',
  'Which assumptions should remain identical before we compare Massachusetts and California results?',
]

export const WEEKLY_REVIEW_QUESTIONS = [
  'Which California finding should lead the next research update?',
  'Which source record or modeling assumption deserves the next round of verification?',
  'What would make this research update easier to discuss with a nontechnical audience?',
]
