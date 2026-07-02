const gradeToGPA = {
  'A+': 4.0,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  'D-': 0.7,
  F: 0.0
};

// A completed letter grade earns credit only at C or better (GPA >= 2.0); C-
// (1.7) and below don't, matching the Cal-GETC / UC-7 "courses below a C don't
// count" rule. Shared by both eligibility/predicates and patterns/transferPatterns.
const meetsCOrBetter = (gpa) => gpa >= 2.0;

export { gradeToGPA, meetsCOrBetter };