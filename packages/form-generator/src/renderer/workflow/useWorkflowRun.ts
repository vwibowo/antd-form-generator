import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenSchema } from '../../schema/screen';
import type { WorkflowNode, WorkflowSchema } from '../../schema/workflow';
import { findWorkflowNode } from '../../schema/workflowGraph';
import type { WorkflowRunState } from './engine';
import type { WorkflowRun } from './runHistory';
import {
  answerRun,
  answerSeed,
  beginRun,
  canGoBack,
  canGoForward,
  furthestState,
  goBack,
  goForward,
  runState,
} from './runHistory';

export interface UseWorkflowRunOptions {
  /** Pre-fill the payload before the first step, e.g. from the signed-in user. */
  seed?: Record<string, unknown>;
  onStepChange?: (state: WorkflowRunState, previous: WorkflowRunState | null) => void;
  onComplete?: (values: Record<string, unknown>, state: WorkflowRunState) => void;
  onBlocked?: (state: WorkflowRunState) => void;
}

export interface WorkflowRunController {
  /** The state under the cursor — where the person is looking. */
  state: WorkflowRunState;
  /** The furthest the run reached. What it collected, and the whole route. */
  furthest: WorkflowRunState;
  /** The node the cursor is on, or `null` when the graph cannot say. */
  node: WorkflowNode | null;
  /** What to open a screen step with. See `answerSeed`. */
  values: Record<string, unknown>;
  /** Form identity for this step *at this position* — use it as a React `key`. */
  stepKey: string;
  /** Screens by node id, so a `summary` node can lay an earlier step out. */
  formSources: Record<string, ScreenSchema>;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Answer the current step and move on. */
  step: (contribution?: Record<string, unknown>) => void;
  back: () => void;
  forward: () => void;
  restart: () => void;
}

/**
 * Run a workflow document in React.
 *
 * The engine is pure and `runHistory` is pure; this is the one `useState` that
 * puts them on screen, and deliberately nothing more. A host that wants its own
 * step chrome uses this and renders whatever it likes; one that wants it working
 * uses `WorkflowRenderer`, which is built on this.
 */
export function useWorkflowRun(
  schema: WorkflowSchema,
  options: UseWorkflowRunOptions = {},
): WorkflowRunController {
  const [run, setRun] = useState<WorkflowRun>(() => beginRun(schema, options.seed));

  // A run holds node and edge ids, so it only means anything against the
  // document it started from. Loading another document, importing, an undo or a
  // JSON edit all replace that document — and a run left pointing at ids that no
  // longer exist reports "nothing to run" instead of starting over.
  const ranAgainst = useRef(schema);
  useEffect(() => {
    if (ranAgainst.current === schema) return;
    ranAgainst.current = schema;
    setRun(beginRun(schema, options.seed));
  }, [schema, options.seed]);

  const state = runState(run);
  const furthest = furthestState(run);
  const node = state.nodeId ? findWorkflowNode(schema, state.nodeId) : null;

  // A `summary` node names the step it lays out, so the run has to hand the
  // schemas over — a payload alone carries no layout.
  const formSources = useMemo(() => {
    const sources: Record<string, ScreenSchema> = {};
    for (const entry of schema.nodes) {
      if (entry.kind === 'screen' && entry.screen) sources[entry.id] = entry.screen;
    }
    return sources;
  }, [schema.nodes]);

  // Memoised because `ScreenRenderer` re-seeds its live form whenever this
  // changes identity, and a parent re-rendering is not a change of values.
  const values = useMemo(() => (node ? answerSeed(run, node) : state.values), [run, node, state]);

  // Reported after commit, not during the setter: a host that navigates or
  // persists in one of these would otherwise do it inside a state update.
  const announced = useRef<WorkflowRunState | null>(null);
  useEffect(() => {
    const previous = announced.current;
    if (previous === state) return;
    announced.current = state;
    options.onStepChange?.(state, previous);
    if (state.status === 'done') options.onComplete?.(state.values, state);
    if (state.status === 'blocked') options.onBlocked?.(state);
  }, [state, options]);

  return {
    state,
    furthest,
    node,
    values,
    stepKey: `${state.nodeId ?? 'none'}:${run.cursor}`,
    formSources,
    canGoBack: canGoBack(run),
    canGoForward: canGoForward(run),
    step: (contribution) => setRun((entry) => answerRun(schema, entry, contribution)),
    back: () => setRun(goBack),
    forward: () => setRun(goForward),
    restart: () => setRun(beginRun(schema, options.seed)),
  };
}
