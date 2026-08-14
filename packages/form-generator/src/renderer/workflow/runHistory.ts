import { collectPayloadKeys } from '../initialValues';
import type { WorkflowRunState } from './engine';
import {
  advanceWorkflow,
  startWorkflow,
} from './engine';
import type { WorkflowNode, WorkflowSchema } from '../../schema/workflow';

/**
 * Driving a run backwards and forwards, which the engine deliberately does not.
 *
 * `advanceWorkflow` puts a step's answer in the state it *returns*, so
 * `history[i]` holds what was known on the way *into* step i. Popping the stack
 * to go back therefore threw the answer away along with the position: the form
 * came back showing schema defaults and "Collected so far" came back empty,
 * because the state holding the answer no longer existed.
 *
 * One array was being asked to be two things, so this separates them:
 *
 * - **Where the run stands, and how it got there** — `history` plus a `cursor`.
 *   Navigating moves the cursor and discards nothing, so what the engine
 *   computed stays exactly as computed.
 * - **What the person typed** — `answers`, one entry per workflow node. Not the
 *   run; a record of answers given. It survives navigating away from a step,
 *   re-answering it, and a branch changing underneath it.
 *
 * Keeping them apart is what lets a step be pre-filled from its own last answer
 * without that answer reaching a branch earlier in the run. The invariant, and
 * the reason there is nothing to leak:
 *
 *   Every entry in `history` is `advanceWorkflow` applied to its predecessor
 *   with a contribution recorded at the node that predecessor was on. Nothing
 *   else ever writes `values`.
 *
 * So an answer re-entering the payload is indistinguishable from the person
 * having typed it at that step, because it is the same operation. `answerSeed`
 * is where that is enforced rather than merely intended.
 *
 * Pure and React-free on purpose: `useWorkflowRun` is queued to take this over,
 * and a hook holding one `useState` around these functions is the whole of it.
 */

/** One answer per workflow node id — the last thing submitted at that step. */
export type WorkflowAnswers = Record<string, Record<string, unknown>>;

export interface WorkflowRun {
  /** Every state the engine produced, oldest first. Navigation never truncates it. */
  history: WorkflowRunState[];
  /** Which one is on screen. `history.length - 1` while the run moves forward. */
  cursor: number;
  answers: WorkflowAnswers;
}

export function beginRun(
  schema: WorkflowSchema,
  seed: Record<string, unknown> = {},
): WorkflowRun {
  return { history: [startWorkflow(schema, seed)], cursor: 0, answers: {} };
}

/** The state the person is looking at. */
export function runState(run: WorkflowRun): WorkflowRunState {
  return run.history[run.cursor];
}

/**
 * The furthest the run has reached — what it has actually collected and the
 * whole route it took, which is what the side column reports even while the
 * cursor is parked further back.
 */
export function furthestState(run: WorkflowRun): WorkflowRunState {
  return run.history[run.history.length - 1];
}

export function canGoBack(run: WorkflowRun): boolean {
  return run.cursor > 0;
}

/**
 * Forward exists exactly when a later state does — and a later state exists only
 * because this step was answered, so "is the current step answered" is not a
 * separate question to ask.
 */
export function canGoForward(run: WorkflowRun): boolean {
  return run.cursor < run.history.length - 1;
}

export function goBack(run: WorkflowRun): WorkflowRun {
  return canGoBack(run) ? { ...run, cursor: run.cursor - 1 } : run;
}

export function goForward(run: WorkflowRun): WorkflowRun {
  return canGoForward(run) ? { ...run, cursor: run.cursor + 1 } : run;
}

/**
 * Answer the step the cursor is on.
 *
 * The answer is recorded and then kept: correcting step 1 must not cost the
 * person steps 2 and 3, which is the whole reason `answers` sits outside
 * `history`.
 *
 * `history` past the cursor cannot simply be kept, though — the new answer may
 * send the run down a different branch, and states computed from the old one
 * describe a run that never happened. So the tail is recomputed rather than
 * trusted.
 */
export function answerRun(
  schema: WorkflowSchema,
  run: WorkflowRun,
  contribution: Record<string, unknown> = {},
): WorkflowRun {
  const current = runState(run);
  if (current.nodeId === null) return run;

  const next = advanceWorkflow(schema, current, contribution);
  // The engine hands the same state back when a run is finished or stuck. Left
  // alone that would append a duplicate entry and light up a Back button which
  // appears to go nowhere.
  if (next === current) return run;

  // Recorded even when empty: presence means "this step was answered", which is
  // what a Continue-only step contributes and what the replay needs to walk past
  // it.
  const answers = { ...run.answers, [current.nodeId]: contribution };
  const tail = run.history.slice(run.cursor + 1);

  return {
    history: [
      ...run.history.slice(0, run.cursor + 1),
      next,
      ...replayTail(schema, answers, next, tail),
    ],
    // One step forward, not a jump to the end: answering moves you exactly one
    // step, and Forward is there for the rest of the tail it just restored.
    cursor: run.cursor + 1,
    answers,
  };
}

/**
 * Rebuild the states after a re-answered step from what was already answered
 * further along.
 *
 * Stopped the moment the run lands somewhere it did not land before: a corrected
 * answer that changes a branch makes the rest of the old tail a different run,
 * and replaying it would be answering questions nobody was asked. Divergence is
 * also exactly where a genuinely new answer is needed, so that is the right
 * place to hand control back.
 *
 * Bounding the walk by the old tail is what makes this terminate on a graph that
 * loops — the engine's own `MAX_AUTO_STEPS` only guards pass-through chains.
 */
function replayTail(
  schema: WorkflowSchema,
  answers: WorkflowAnswers,
  from: WorkflowRunState,
  tail: WorkflowRunState[],
): WorkflowRunState[] {
  const rebuilt: WorkflowRunState[] = [];
  let current = from;

  for (const before of tail) {
    if (current.status !== 'running' || current.nodeId === null) break;
    if (current.nodeId !== before.nodeId) break;

    const answer = answers[current.nodeId];
    if (!answer) break;

    const next = advanceWorkflow(schema, current, answer);
    if (next === current) break;

    rebuilt.push(next);
    current = next;
  }

  return rebuilt;
}

/**
 * What to open a step's screen with: everything the run knows at this point,
 * with this step's own last answer laid over the top.
 *
 * The accumulated payload has to be the base — a `{{token}}` or a `summary` on
 * this screen reads earlier steps out of it, and on a collecting screen that
 * happens through the live form store, so those keys have to be in there.
 *
 * The overlay is restricted to the keys this screen collects, and that
 * restriction is the safety argument made mechanical: an answer can be put back
 * in the box it came out of, and nowhere else. It also drops the synthetic key
 * an `actions` step contributes — the run has not pressed that button at this
 * position, so a condition on this screen must not read as though it had, even
 * though the key itself has to stay in `answers` for the branch to be retaken.
 *
 * Returns `values` itself when there is nothing to lay over it, so React sees a
 * stable object and `ScreenRenderer` does not re-seed a live form for nothing.
 */
export function answerSeed(run: WorkflowRun, node: WorkflowNode): Record<string, unknown> {
  const { values } = runState(run);
  const answer = run.answers[node.id];
  if (!answer || !node.screen) return values;

  const owned = collectPayloadKeys(node.screen);
  let seeded: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(answer)) {
    if (!owned.has(key)) continue;
    seeded ??= { ...values };
    seeded[key] = value;
  }

  return seeded ?? values;
}
