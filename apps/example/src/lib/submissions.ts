import type { DocumentKind } from '@antd-form-generator/core';

/**
 * What staff have actually sent in.
 *
 * The other half of the loop: a document is a question, a submission is an
 * answer, and the console is only interesting once both exist. Payloads are
 * stored exactly as `onSubmit` hands them over — payload shape, JSON-ready —
 * because that is what a real backend would receive and what `SummaryRenderer`
 * expects to read back.
 */

const KEY = 'meridian:submissions';

export interface Submission {
  id: string;
  documentId: string;
  documentTitle: string;
  kind: DocumentKind;
  payload: Record<string, unknown>;
  submittedAt: string;
  /** Workflow runs only: the node ids visited, in order. */
  trace?: string[];
}

function read(): Submission[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Submission[]) : [];
  } catch {
    return [];
  }
}

function write(entries: Submission[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Over quota. The caller's own list is still correct for this session.
  }
}

/** Newest first — an inbox reads backwards. */
export function listSubmissions(): Submission[] {
  return read().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function getSubmission(id: string): Submission | undefined {
  return read().find((entry) => entry.id === id);
}

export function addSubmission(entry: Omit<Submission, 'id' | 'submittedAt'>): Submission {
  const submission: Submission = {
    ...entry,
    id: `sub_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    submittedAt: new Date().toISOString(),
  };
  write([submission, ...read()]);
  return submission;
}

export function clearSubmissions(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
