import type { DocumentKind } from '@antd-form-generator/core';
import { parseDocument } from '@antd-form-generator/core';
import { SAMPLE_PRESETS } from '@antd-form-generator/core/schema/samples';
import { TABLE_SAMPLE_PRESETS } from '@antd-form-generator/core/schema/samples/tables';
import { WORKFLOW_SAMPLE_PRESETS } from '@antd-form-generator/core/schema/samples/workflows';

/**
 * The console's own library of documents.
 *
 * A host app does not keep one document per kind the way the builder does — it
 * keeps many, and each is a thing staff can be sent to. So this is the app's
 * store, in the app's own key namespace: the builder writes
 * `antd-form-generator:*` and nothing here ever touches those.
 *
 * Everything is re-parsed on read. A document is JSON that has been through
 * localStorage, a paste box, or someone's export file, so it is untrusted input
 * in exactly the way `parseDocument` exists for. An entry that no longer parses
 * is dropped rather than crashing a route that renders it.
 */

const KEY = 'meridian:documents';

export type DocumentSource = 'sample' | 'builder' | 'import';

export interface LibraryDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  description: string;
  source: DocumentSource;
  /** Parsed and valid for its `kind`. */
  schema: unknown;
  savedAt: string;
}

function read(): LibraryDocument[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Private browsing, or storage disabled. An empty library still renders.
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: LibraryDocument[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as LibraryDocument;
    const result = parseDocument(candidate.schema);
    // Keep the parser's output, not the stored value: it fills defaults, so a
    // document saved before a field existed still renders with that field.
    if (!result.ok || result.kind !== candidate.kind) continue;
    out.push({ ...candidate, schema: result.schema });
  }
  return out;
}

function write(documents: LibraryDocument[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(documents));
  } catch {
    // Over quota or blocked. The in-memory list the caller holds is still right.
  }
}

/** Every sample preset, as library entries. The console's starting content. */
function seedEntries(): LibraryDocument[] {
  const at = new Date().toISOString();
  // The presets are `{ key, label, description, create() }` — `create` is a
  // factory, so each call yields a fresh, fully-defaulted document.
  return [
    ...SAMPLE_PRESETS.map((preset) => ({
      id: `screen-${preset.key}`,
      kind: 'screen' as const,
      title: preset.label,
      description: preset.description,
      source: 'sample' as const,
      schema: preset.create(),
      savedAt: at,
    })),
    ...TABLE_SAMPLE_PRESETS.map((preset) => ({
      id: `table-${preset.key}`,
      kind: 'table' as const,
      title: preset.label,
      description: preset.description,
      source: 'sample' as const,
      schema: preset.create(),
      savedAt: at,
    })),
    ...WORKFLOW_SAMPLE_PRESETS.map((preset) => ({
      id: `workflow-${preset.key}`,
      kind: 'workflow' as const,
      title: preset.label,
      description: preset.description,
      source: 'sample' as const,
      schema: preset.create(),
      savedAt: at,
    })),
  ];
}

/**
 * Everything in the library, seeding it on first run.
 *
 * Seeding on read rather than at import time so a cleared library refills itself
 * — a demo that has been emptied should not need a hard reload to come back.
 */
export function listDocuments(): LibraryDocument[] {
  const stored = read();
  if (stored.length > 0) return stored;
  const seeded = seedEntries();
  write(seeded);
  return seeded;
}

export function getDocument(id: string): LibraryDocument | undefined {
  return listDocuments().find((entry) => entry.id === id);
}

export function documentsOfKind(kind: DocumentKind): LibraryDocument[] {
  return listDocuments().filter((entry) => entry.kind === kind);
}

/** Add or replace an entry. Returns the whole library, already re-read. */
export function saveDocument(entry: Omit<LibraryDocument, 'savedAt'>): LibraryDocument[] {
  const next = listDocuments().filter((existing) => existing.id !== entry.id);
  next.unshift({ ...entry, savedAt: new Date().toISOString() });
  write(next);
  return next;
}

export function removeDocument(id: string): LibraryDocument[] {
  const next = listDocuments().filter((entry) => entry.id !== id);
  write(next);
  return next;
}

/** Throw the library away. The next read re-seeds from the presets. */
export function resetLibrary(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do — a library that cannot be cleared is not worth a crash.
  }
}

/**
 * What the builder currently has open, for the Publish button.
 *
 * Reaches into the builder's own persisted state, which is the one place this
 * app knowingly couples to it. The shape is zustand's `persist` wrapper, and the
 * stores `partialize` down to `{ schema }`.
 */
export function readBuilderDocument(kind: DocumentKind): unknown | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(`antd-form-generator:${kind}`);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const wrapper = JSON.parse(raw) as { state?: { schema?: unknown } };
    const result = parseDocument(wrapper?.state?.schema);
    return result.ok ? result.schema : null;
  } catch {
    return null;
  }
}
