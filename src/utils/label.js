const KNOWN_ACRONYMS = new Set(['AMRAP', 'EMOM', 'HIIT', 'RPE', 'RM'])

export function toTitleCase(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const uppercaseWord = word.toUpperCase()
      if (KNOWN_ACRONYMS.has(uppercaseWord)) {
        return uppercaseWord
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
    })
    .join(' ')
}
