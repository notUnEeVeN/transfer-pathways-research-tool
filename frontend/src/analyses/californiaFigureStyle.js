/**
 * Shared publication styling for the modern California-paper figures.
 *
 * Keep the legacy renderers self-contained: these tokens are deliberately
 * consumed only by current/ASSIST views and their gallery previews.
 */
export const CA_FIGURE = Object.freeze({
  width: 1240,
  background: '#FFFFFF',
  ink: '#193018',
  mutedLine: '#9CA69B',
  grid: 'rgba(25, 48, 24, 0.10)',
  blue: '#2E5C8A',
  navy: '#24466F',
  fontFamily: "'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
})

export const CA_CHOICE_COLORS = Object.freeze([
  '#1E3A5F',
  '#38618C',
  '#6E93BF',
  '#A9C3DE',
])

export const CA_COURSE_COLORS = Object.freeze({
  calculus: '#0072B2',
  intro_programming: '#E69F00',
  data_structures: '#009E73',
  advanced_math: '#CC79A7',
  computer_organization: '#56B4E9',
  discrete_math: '#D55E00',
})

export const CA_DIFFERENCE_COLORS = Object.freeze({
  gained: '#0D7964',
  lost: '#CB1D51',
})

export const CA_QUARTER_NOTE = '* quarter-system campus · unmarked = semester'
