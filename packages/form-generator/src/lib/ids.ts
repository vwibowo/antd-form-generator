let fallbackCounter = 0;

/** Stable unique id for builder nodes. Not part of submitted form data. */
export function createId(prefix = 'f'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  fallbackCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${fallbackCounter}`;
}
