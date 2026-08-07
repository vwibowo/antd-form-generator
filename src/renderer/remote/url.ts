import { isEmpty } from '../condition';

/**
 * `{{fieldName}}` templating for remote option URLs.
 *
 * A dependency is a plain field name, resolved against live form values by the
 * caller — see `useRemoteOptions`, which delegates to `resolveConditionValue`
 * so row-local-then-root lookup works exactly as it does for conditions.
 */

const TOKEN = /\{\{\s*([A-Za-z0-9_$]+)\s*\}\}/g;

/** Field names referenced as `{{name}}`, in order, deduped. */
export function extractDependencies(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(TOKEN)) {
    const name = match[1];
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export interface ResolvedUrl {
  url: string;
  /** Dependencies whose live value is empty — the request must not fire. */
  missing: string[];
}

/** A multi-select dependency contributes all its values. */
function stringify(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(',');
  return String(value);
}

/**
 * Substitute `{{field}}` with live form values.
 *
 * Every substituted value is `encodeURIComponent`-ed. Without that, a value the
 * user typed could add a path segment or an extra query parameter — the one
 * genuine injection vector in this feature.
 */
export function resolveUrlTemplate(
  template: string,
  read: (field: string) => unknown,
): ResolvedUrl {
  const missing: string[] = [];

  const url = template.replace(TOKEN, (_match, field: string) => {
    const value = read(field);
    if (isEmpty(value)) {
      if (!missing.includes(field)) missing.push(field);
      return '';
    }
    return encodeURIComponent(stringify(value));
  });

  return { url, missing };
}

/**
 * Append the search term as a query parameter.
 * Returns `null` for a URL that does not parse — the same tolerance
 * `compileRules` shows a half-typed regex, so typing in the inspector cannot
 * take down the preview.
 */
export function withSearchParam(url: string, param: string, term: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set(param, term);
    return parsed.toString();
  } catch {
    return null;
  }
}
