import dayjs from 'dayjs';
import { TOKEN } from '../remote/url';

/**
 * `{{field}}` substitution for page text.
 *
 * The plain-text sibling of `resolveUrlTemplate`. That one
 * `encodeURIComponent`s every substitution, because a value the user typed
 * could otherwise add a path segment or a query parameter to a URL — a real
 * injection vector there, and exactly the wrong thing to do to prose. Both
 * share `TOKEN` so the syntax cannot drift between them.
 *
 * A missing or empty value renders as nothing rather than as the raw
 * `{{field}}`: this text is read by whoever the workflow is for, and showing
 * them the template is worse than showing them a gap.
 */

/**
 * A payload value as page text.
 *
 * Deliberately shallow. `formatFieldValue` is the field-aware formatter, but it
 * needs the `FieldNode` that produced the value, which a raw payload does not
 * carry — that is what the `summary` block is for. Here an ISO date is the one
 * case worth special-casing, because a payload is full of them and
 * `2026-08-09T17:00:00.000Z` in a sentence is unreadable.
 */
export function valueToText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value
      .map((entry) => valueToText(entry))
      .filter((entry) => entry !== '')
      .join(', ');
  }

  if (typeof value === 'string') {
    // Only reformat what is unambiguously a full ISO timestamp; a plain
    // `2026-08-09` is already readable, and a reference like `FI-204` must
    // never be mistaken for a date.
    if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
      const parsed = dayjs(value);
      if (parsed.isValid()) return parsed.format('D MMM YYYY');
    }
    return value;
  }

  if (typeof value === 'object') {
    const maybeDayjs = value as { isValid?: () => boolean; format?: (p: string) => string };
    if (typeof maybeDayjs.isValid === 'function' && typeof maybeDayjs.format === 'function') {
      return maybeDayjs.isValid() ? maybeDayjs.format('D MMM YYYY') : '';
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return String(value);
}

/** Substitute every `{{field}}` in `template` from `values`. */
export function resolveTextTemplate(
  template: string,
  values: Record<string, unknown> = {},
): string {
  if (template === '') return '';
  return template.replace(TOKEN, (_match, field: string) => valueToText(values[field]));
}

/** Field names a page's text refers to, for the "what can I bind?" hints. */
export function textDependencies(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(TOKEN)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}
