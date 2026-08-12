import type { DocumentKind } from './document';
import { parseDocument } from './document';
import type { ScreenSchema } from './screen';
import { collectsValue, hasNoWayOnward, walkScreenNodes } from './screen';
import { ROOT_CONTAINER_ID, canDropInto, findDuplicateNames, findParent } from './walk';
import { validateWorkflow } from './workflowGraph';

/**
 * Everything wrong with a document, in one call.
 *
 * Exists because the JSON *is* the product: it can be hand-authored, pasted into
 * the JSON tab, or written by an agent from a requirement, and none of those go
 * anywhere near the drag-and-drop that enforces half the rules. `parseDocument`
 * checks the shape, but plenty of ways to be wrong parse cleanly — a repeatable
 * nested a level too deep, a summary pointing at a step that does not exist, two
 * screens claiming the same payload key.
 *
 * A composition, deliberately: every check here already existed and is used by
 * the builder or the tests. Reimplementing any of them is how the CLI and the
 * app would start disagreeing.
 *
 * Advice, never a verdict — same contract `validateWorkflow` has. Nothing here
 * blocks a parse or an import, because a document being edited is allowed to be
 * broken on the way to being right.
 */

export interface Diagnostic {
  /** `error` means it will not work; `warning` means it probably is not meant. */
  level: 'error' | 'warning';
  /** Stable code, so output can be grouped or suppressed without matching prose. */
  code: string;
  message: string;
  /** A zod path like `nodes.2.children.0`, or a workflow node id. */
  path?: string;
}

/**
 * Nodes sitting somewhere the builder would refuse to put them.
 *
 * Replays the real drop rule rather than describing it, so the two cannot drift.
 * This is what catches a screen written four containers deep, or a tab strip
 * holding a field instead of a card.
 */
export function unbuildableNodes(schema: ScreenSchema): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const node of walkScreenNodes(schema.nodes)) {
    const parent = findParent(schema.nodes, node.id);
    const containerId = parent ? parent.id : ROOT_CONTAINER_ID;
    if (canDropInto(schema, node.type, containerId)) continue;
    out.push({
      level: 'error',
      code: 'illegal-nesting',
      message: `A "${node.type}" cannot go inside ${
        parent ? `a "${parent.type}"` : 'the root'
      }. Containers nest at most root > tabs > card > list, and a tab strip holds only cards.`,
      path: node.id,
    });
  }
  return out;
}

/** Screen-level checks, applied to a standalone screen and to an embedded one. */
function checkScreen(schema: ScreenSchema, prefix = ''): Diagnostic[] {
  const out: Diagnostic[] = [...unbuildableNodes(schema)];

  for (const name of findDuplicateNames(schema.nodes)) {
    out.push({
      level: 'warning',
      code: 'duplicate-name',
      message: `More than one node collects "${name}", so the later one wins.`,
      path: prefix || undefined,
    });
  }

  // A node that owns a payload key but has no name submits under "", which
  // collides with every other unnamed one.
  for (const node of walkScreenNodes(schema.nodes)) {
    if (!collectsValue(node.type) || node.name.trim() !== '') continue;
    out.push({
      level: 'error',
      code: 'missing-name',
      message: `A "${node.type}" collects a value but has no name, so it cannot reach the payload.`,
      path: node.id,
    });
  }

  if (schema.nodes.length === 0) {
    out.push({
      level: 'warning',
      code: 'empty-screen',
      message: 'This screen has no nodes.',
      path: prefix || undefined,
    });
  } else if (hasNoWayOnward(schema)) {
    out.push({
      level: 'warning',
      code: 'no-way-onward',
      message: 'Nothing here collects a value and there are no buttons, so there is no way onward.',
      path: prefix || undefined,
    });
  }

  return out;
}

export interface ValidationResult {
  /** Absent when the document did not even parse. */
  kind?: DocumentKind;
  diagnostics: Diagnostic[];
}

/** Parse `input`, then run every check that applies to whatever it turned out to be. */
export function validateDocument(input: unknown): ValidationResult {
  const parsed = parseDocument(input);
  if (!parsed.ok) {
    return {
      diagnostics: parsed.errors.map((error) => {
        // `parseDocument` formats zod issues as `path: message`.
        const split = error.indexOf(': ');
        return {
          level: 'error' as const,
          code: 'invalid-shape',
          message: split === -1 ? error : error.slice(split + 2),
          path: split === -1 ? undefined : error.slice(0, split),
        };
      }),
    };
  }

  if (parsed.kind === 'screen') {
    return { kind: 'screen', diagnostics: checkScreen(parsed.schema) };
  }

  if (parsed.kind === 'workflow') {
    const diagnostics: Diagnostic[] = validateWorkflow(parsed.schema).map((issue) => ({
      level: issue.level,
      code: issue.code,
      message: issue.message,
      path: issue.nodeId ?? issue.edgeId,
    }));

    // An embedded screen is a screen: the same rules, reported against the step
    // that holds it so the message says where to look.
    for (const node of parsed.schema.nodes) {
      if (node.kind !== 'screen' || !node.screen) continue;
      diagnostics.push(
        ...checkScreen(node.screen, node.id).map((entry) => ({
          ...entry,
          path: entry.path ?? node.id,
        })),
      );
    }

    return { kind: 'workflow', diagnostics };
  }

  // A table's contract is entirely shape, and zod has already checked it.
  return { kind: parsed.kind, diagnostics: [] };
}

/** True when nothing would stop this document working. Warnings are allowed. */
export function isValid(result: ValidationResult): boolean {
  return !result.diagnostics.some((entry) => entry.level === 'error');
}
