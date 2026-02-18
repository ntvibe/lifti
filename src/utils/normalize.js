export function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^\w]/g, '')
    .replace(/_+/g, '_')
}

export function titleCaseLabel(value = '') {
  const normalized = normalizeKey(value).replace(/_/g, ' ').trim()

  if (!normalized) {
    return ''
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}
