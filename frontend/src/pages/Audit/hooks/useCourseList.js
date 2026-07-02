import { useMemo } from 'react'

/**
 * Convert the server's course_names map (`{id: {code, title, units}}`) into
 * the shape RequirementsLedger expects (`[{course_id, prefix, number, title,
 * units}, ...]`).
 */
export function useCourseList(courseNames) {
  return useMemo(() => {
    if (!courseNames) return []
    return Object.entries(courseNames).map(([course_id, info]) => {
      const code = info.code || ''
      const [prefix = '', number = ''] = code.split(/\s+/, 2)
      return {
        course_id: Number(course_id),
        prefix,
        number,
        title: info.title || '',
        units: info.units ?? 0
      }
    })
  }, [courseNames])
}
