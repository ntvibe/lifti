import { titleCaseLabel } from './normalize'

const KNOWN_ACRONYMS = new Set(['AMRAP', 'EMOM', 'HIIT', 'RPE', 'RM'])

export function toTitleCase(value = '') {
  const formatted = titleCaseLabel(value)

  return formatted
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const uppercaseWord = word.toUpperCase()
      if (KNOWN_ACRONYMS.has(uppercaseWord)) {
        return uppercaseWord
      }

      return word
    })
    .join(' ')
}
