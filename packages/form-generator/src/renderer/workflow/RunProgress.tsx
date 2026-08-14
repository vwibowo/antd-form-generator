import { Steps } from 'antd';
import { useMemo } from 'react';
import type { WorkflowSchema } from '../../schema/workflow';
import { findWorkflowNode, workflowStages } from '../../schema/workflowGraph';
import { nodeCaption } from '../../schema/workflowRegistry';
import type { WorkflowRunState } from './engine';

export interface RunProgressProps {
  schema: WorkflowSchema;
  /** Where the run is now — the cursor's state. */
  state: WorkflowRunState;
  /** The furthest it reached, which is what captions the stages. */
  furthest: WorkflowRunState;
}

/**
 * How far along the run is — the wizard's "step 3 of 5".
 *
 * Driven entirely by the graph, so there is nothing to author and nothing that
 * can drift out of step with the flow. That is why this is not a screen node: a
 * `steps` block dropped onto a screen would have to be maintained by hand and
 * could not see the run anyway.
 *
 * A stage the run has actually visited is captioned with the step it took,
 * because that is known. One it has not is captioned generically when the
 * branches diverge — the graph cannot say which of two routes the reader will be
 * sent down, and guessing would be worse than admitting it.
 */
export function RunProgress({ schema, state, furthest }: RunProgressProps) {
  const stages = useMemo(() => workflowStages(schema), [schema]);
  if (stages.length < 2) return null;

  // Where the run *is* comes from the cursor, so stepping back moves the marker
  // and a run stepped back off a wall stops reporting an error. Which stages
  // have a step to name comes from the furthest state: a visited stage is
  // captioned with the step it took because that is known, and stepping
  // backwards does not unknow it. Captions vanishing on Back would make the bar
  // look like it had forgotten the route when only the marker moved.
  const visited = new Set(furthest.trace);
  const currentIndex = stages.findIndex((stage) =>
    stage.nodeIds.some((id) => id === state.nodeId),
  );

  return (
    <Steps
      size="small"
      // A loop back makes an already-finished stage current again, so `current`
      // is where the run *is*, not how many stages it has been through.
      current={currentIndex === -1 ? 0 : currentIndex}
      status={state.status === 'blocked' ? 'error' : 'process'}
      items={stages.map((stage, index) => {
        const takenId = stage.nodeIds.find((id) => visited.has(id));
        const taken = takenId ? findWorkflowNode(schema, takenId) : null;
        return {
          title: taken ? nodeCaption(taken) : stage.label,
          // Behind the current stage but never visited: the run went the other
          // way, so it is not "done" — it simply does not apply.
          status:
            index < currentIndex && !takenId
              ? ('wait' as const)
              : index < currentIndex
                ? ('finish' as const)
                : undefined,
        };
      })}
    />
  );
}
