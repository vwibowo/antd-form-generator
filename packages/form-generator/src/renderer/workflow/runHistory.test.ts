import { advanceWorkflow } from './engine';
import { screenSchemaSchema } from '../../schema/screen';
import { workflowSchemaSchema } from '../../schema/workflow';
import type { WorkflowSchema } from '../../schema/workflow';
import { describe, expect, it } from 'vitest';
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

/**
 * Going back to a step has to bring back what was answered there.
 *
 * It did not, and the reason is worth keeping in front of whoever changes this
 * next: `advanceWorkflow` merges a step's contribution into the state it
 * *returns*, so the state whose `nodeId` is step N holds what was known on the
 * way *in*. Popping the stack to go back landed on that state and discarded the
 * only one that held N's answer — the form came back showing schema defaults.
 *
 * These run in the node environment against the pure module, so everything below
 * is reachable without rendering anything.
 */

const screen = (nodes: unknown[]) => screenSchemaSchema.parse({ nodes });

/** start -> ask -> gate(decision) -> cheap | pricey -> end */
function branching(): WorkflowSchema {
  return workflowSchemaSchema.parse({
    nodes: [
      { id: 'start', kind: 'start' },
      {
        id: 'ask',
        kind: 'screen',
        screen: screen([
          { id: 'f1', type: 'input', name: 'who' },
          { id: 'f2', type: 'number', name: 'amount' },
        ]),
      },
      { id: 'gate', kind: 'decision' },
      {
        id: 'cheap',
        kind: 'screen',
        screen: screen([{ id: 'f3', type: 'input', name: 'note' }]),
      },
      {
        id: 'pricey',
        kind: 'screen',
        screen: screen([{ id: 'f4', type: 'input', name: 'approver' }]),
      },
      { id: 'end', kind: 'end' },
    ],
    edges: [
      { id: 'e1', from: 'start', to: 'ask' },
      { id: 'e2', from: 'ask', to: 'gate' },
      {
        id: 'e3',
        from: 'gate',
        to: 'pricey',
        priority: 1,
        condition: { logic: 'and', conditions: [{ field: 'amount', operator: 'gt', value: 100 }] },
      },
      { id: 'e4', from: 'gate', to: 'cheap', isDefault: true },
      { id: 'e5', from: 'cheap', to: 'end' },
      { id: 'e6', from: 'pricey', to: 'end' },
    ],
  });
}

const nodeOf = (schema: WorkflowSchema, id: string) =>
  schema.nodes.find((node) => node.id === id)!;

describe('the reported bug', () => {
  it('keeps a step answer reachable after going back to it', () => {
    const schema = branching();
    let run = beginRun(schema);
    expect(runState(run).nodeId).toBe('ask');

    run = answerRun(schema, run, { who: 'Ada', amount: 40 });
    run = goBack(run);

    expect(runState(run).nodeId).toBe('ask');
    // The state the cursor sits on still holds only what was known on the way in
    // — that part of the engine is correct and unchanged.
    expect(runState(run).values).toEqual({});
    // What the run collected, and what the step is re-opened with, both survive.
    // The old `history.slice(0, -1)` could satisfy neither.
    expect(furthestState(run).values).toEqual({ who: 'Ada', amount: 40 });
    expect(answerSeed(run, nodeOf(schema, 'ask'))).toEqual({ who: 'Ada', amount: 40 });
  });
});

describe('navigation', () => {
  it('is a no-op at either end', () => {
    const schema = branching();
    const fresh = beginRun(schema);
    expect(canGoBack(fresh)).toBe(false);
    expect(goBack(fresh)).toBe(fresh);

    const answered = answerRun(schema, fresh, { who: 'Ada', amount: 40 });
    expect(canGoForward(answered)).toBe(false);
    expect(goForward(answered)).toBe(answered);
  });

  it('offers Forward only where a later state exists, which means answered', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = goBack(run);

    expect(canGoForward(run)).toBe(true);
    // The structural reason Forward needs no "is this step answered?" check: a
    // later state exists *only* because answering appended it.
    expect(run.answers[runState(run).nodeId!]).toBeDefined();

    expect(runState(goForward(run)).nodeId).toBe('cheap');
  });
});

describe('re-answering', () => {
  it('keeps the tail when the branch does not change', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = answerRun(schema, run, { note: 'for the team' });
    expect(runState(run).status).toBe('done');

    // Go back and fix a typo that does not cross the branch threshold.
    run = goBack(run);
    run = goBack(run);
    run = answerRun(schema, run, { who: 'Ada Lovelace', amount: 40 });

    // The downstream step was not re-answered, and did not need to be.
    expect(canGoForward(run)).toBe(true);
    expect(runState(run).nodeId).toBe('cheap');
    // The correction propagated into every state after it.
    expect(furthestState(run).values).toEqual({
      who: 'Ada Lovelace',
      amount: 40,
      note: 'for the team',
    });
    // And the step still pre-fills from its own recorded answer.
    expect(answerSeed(run, nodeOf(schema, 'cheap'))).toMatchObject({ note: 'for the team' });
  });

  it('stops the replay where the branch diverges', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = answerRun(schema, run, { note: 'for the team' });

    run = goBack(run);
    run = goBack(run);
    // Now over the threshold, so the run routes to `pricey` instead.
    run = answerRun(schema, run, { who: 'Ada', amount: 5000 });

    expect(runState(run).nodeId).toBe('pricey');
    // Nothing invented past the divergence: `cheap`'s old tail described a run
    // that no longer happens.
    expect(canGoForward(run)).toBe(false);
    expect(furthestState(run).values.note).toBeUndefined();
  });

  it('still offers an answer from before a detour, without replaying it', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = answerRun(schema, run, { note: 'for the team' });

    const toAsk = (entry: typeof run) => goBack(goBack(entry));

    // Detour onto the other branch, then back again.
    run = answerRun(schema, toAsk(run), { who: 'Ada', amount: 5000 });
    run = answerRun(schema, toAsk(run), { who: 'Ada', amount: 40 });
    expect(runState(run).nodeId).toBe('cheap');

    // The note is *not* back in the payload, and should not be: replay is
    // bounded by the tail that is actually there, and the detour already
    // replaced it with the `pricey` route. Anything else would mean walking a
    // path from recorded answers alone, which on a looping graph does not
    // terminate and which re-decides branches from answers the run has not
    // reached yet.
    expect(furthestState(run).values.note).toBeUndefined();

    // What decision 2 actually promises is still kept: nothing has to be
    // retyped. The answer survived the detour in `answers`, so the step reopens
    // pre-filled and one Submit puts it back.
    expect(run.answers.cheap).toEqual({ note: 'for the team' });
    expect(answerSeed(run, nodeOf(schema, 'cheap'))).toMatchObject({
      note: 'for the team',
    });
  });

  it('returns the same run for a finished or stuck state', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = answerRun(schema, run, { note: 'done' });
    expect(runState(run).status).toBe('done');

    // Otherwise this appends a duplicate entry and lights a Back button that
    // appears to go nowhere.
    expect(answerRun(schema, run, { anything: true })).toBe(run);
  });
});

describe('answerSeed', () => {
  it('lays a step answer over the accumulated payload', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = answerRun(schema, run, { note: 'for the team' });
    run = goBack(run);

    // The base is what the run knows here — a `{{token}}` or `summary` on this
    // screen reads earlier steps out of it — with this step's own answer on top.
    expect(answerSeed(run, nodeOf(schema, 'cheap'))).toEqual({
      who: 'Ada',
      amount: 40,
      note: 'for the team',
    });
  });

  it('overlays only the keys the screen collects', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 40 });
    run = goBack(run);

    // `ask` does not collect `note`, so an answer recorded elsewhere cannot
    // reach it. This is the leak-proofing made mechanical rather than argued.
    run = { ...run, answers: { ...run.answers, ask: { who: 'Ada', note: 'elsewhere' } } };
    const seed = answerSeed(run, nodeOf(schema, 'ask'));
    expect(seed.who).toBe('Ada');
    expect(seed.note).toBeUndefined();
  });

  it('drops the synthetic key an actions step contributes', () => {
    const schema = branching();
    let run = beginRun(schema);
    // `onAction` merges `[node.name || 'choice']` in so a branch can test it.
    run = answerRun(schema, run, { who: 'Ada', amount: 40, choice: 'submit' });
    run = goBack(run);

    // It has to stay recorded, or the branch cannot be retaken...
    expect(run.answers.ask.choice).toBe('submit');
    // ...but must not seed the form: the button has not been pressed at this
    // position, and a condition on this screen would read as though it had.
    expect(answerSeed(run, nodeOf(schema, 'ask')).choice).toBeUndefined();
  });

  it('returns the very same object when there is nothing to overlay', () => {
    const schema = branching();
    const run = beginRun(schema);
    // `ScreenRenderer` re-seeds its live form whenever this changes identity, so
    // a new object per render would fight whatever is being typed.
    expect(answerSeed(run, nodeOf(schema, 'ask'))).toBe(runState(run).values);
  });
});

describe('the invariant', () => {
  it('holds: every state is its predecessor advanced by that node’s answer', () => {
    const schema = branching();
    let run = answerRun(schema, beginRun(schema), { who: 'Ada', amount: 5000 });
    run = answerRun(schema, run, { approver: 'Grace' });

    // A structural proof that no answer moved sideways: each entry is reachable
    // from the one before it using only the answer recorded at that node.
    //
    // Asserted on a linear path. Across a loop it would not hold, and correctly
    // so — `history` is what happened, while `answers` is what is believed now,
    // and a second visit overwrites the first.
    for (let i = 1; i < run.history.length; i += 1) {
      const previous = run.history[i - 1];
      const answer = run.answers[previous.nodeId!] ?? {};
      expect(run.history[i]).toEqual(advanceWorkflow(schema, previous, answer));
    }
  });
});

describe('a graph that loops', () => {
  /** start -> form -> check -> (back to form | end) */
  function looping(): WorkflowSchema {
    return workflowSchemaSchema.parse({
      nodes: [
        { id: 'start', kind: 'start' },
        {
          id: 'form',
          kind: 'screen',
          screen: screen([{ id: 'f1', type: 'input', name: 'detail' }]),
        },
        { id: 'check', kind: 'approval', name: 'decision', outcomes: [
          { id: 'more', label: 'Needs more' },
          { id: 'ok', label: 'Looks right' },
        ] },
        { id: 'end', kind: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'form' },
        { id: 'e2', from: 'form', to: 'check' },
        {
          id: 'e3',
          from: 'check',
          to: 'form',
          priority: 1,
          condition: { logic: 'and', conditions: [{ field: 'decision', operator: 'eq', value: 'more' }] },
        },
        { id: 'e4', from: 'check', to: 'end', isDefault: true },
      ],
    });
  }

  it('keeps one answer per node, the most recent', () => {
    const schema = looping();
    let run = answerRun(schema, beginRun(schema), { detail: 'first go' });
    run = answerRun(schema, run, { decision: 'more' });
    expect(runState(run).nodeId).toBe('form');

    run = answerRun(schema, run, { detail: 'second go' });

    // Node-id keying, deliberately: there is one form and one current answer,
    // which is what a reader revising a step expects. A per-visit ledger would
    // bring back the first attempt.
    expect(run.answers.form).toEqual({ detail: 'second go' });
    expect(answerSeed(run, nodeOf(schema, 'form'))).toMatchObject({ detail: 'second go' });
  });

  it('terminates when replaying a loop', () => {
    const schema = looping();
    let run = answerRun(schema, beginRun(schema), { detail: 'first go' });
    run = answerRun(schema, run, { decision: 'more' });
    run = answerRun(schema, run, { detail: 'second go' });
    run = answerRun(schema, run, { decision: 'ok' });
    expect(runState(run).status).toBe('done');

    // Re-answering the first step replays a tail whose recorded answers would
    // otherwise send it round the loop for ever; the walk is bounded by the old
    // tail, so it stops.
    const before = run.history.length;
    run = answerRun(schema, { ...run, cursor: 0 }, { detail: 'third go' });
    expect(run.history.length).toBeLessThanOrEqual(before);
  });
});
