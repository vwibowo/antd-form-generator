import { ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Tag, Tooltip } from 'antd';
import { useMemo } from 'react';
import type { NodeAction, WorkflowNode, WorkflowSchema } from '../../schema/workflow';
import { validateWorkflow } from '../../schema/workflowGraph';
import { nodeCaption } from '../../schema/workflowRegistry';
import type { WorkflowRunState } from './engine';
import { RunProgress } from './RunProgress';
import { useWorkflowRun } from './useWorkflowRun';
import { WorkflowStepView } from './WorkflowStepView';

export interface WorkflowRendererProps {
  schema: WorkflowSchema;
  /** Pre-fill the payload before the first step. */
  seed?: Record<string, unknown>;
  /**
   * An `action` node was reached and its button pressed. Awaited before the run
   * advances, so a host can do the work the document only names.
   */
  onAction?: (action: NodeAction, node: WorkflowNode) => void | Promise<void>;
  onStepChange?: (state: WorkflowRunState, previous: WorkflowRunState | null) => void;
  onComplete?: (values: Record<string, unknown>, state: WorkflowRunState) => void;
  onBlocked?: (state: WorkflowRunState) => void;
  /** Hide the progress bar when the host draws its own. */
  showProgress?: boolean;
  /** Hide Back / Forward / Restart when the host drives navigation itself. */
  showControls?: boolean;
  /** Surface `validateWorkflow` errors above the step. On by default. */
  showProblems?: boolean;
}

/**
 * A workflow document, actually run.
 *
 * The batteries-included half of the pair: `useWorkflowRun` is the state, this
 * is one arrangement of it. A host that wants different chrome takes the hook
 * and renders `WorkflowStepView` itself — that is the whole reason they are two
 * modules rather than one.
 */
export function WorkflowRenderer({
  schema,
  seed,
  onAction,
  onStepChange,
  onComplete,
  onBlocked,
  showProgress = true,
  showControls = true,
  showProblems = true,
}: WorkflowRendererProps) {
  const run = useWorkflowRun(schema, { seed, onStepChange, onComplete, onBlocked });

  const errors = useMemo(
    () => (showProblems ? validateWorkflow(schema).filter((issue) => issue.level === 'error') : []),
    [schema, showProblems],
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {errors.length > 0 ? (
        <Alert
          type="error"
          showIcon
          title={`${errors.length} problem${errors.length === 1 ? '' : 's'} in this workflow`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.slice(0, 4).map((issue) => (
                <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId}`} style={{ fontSize: 12 }}>
                  {issue.message}
                </li>
              ))}
            </ul>
          }
        />
      ) : null}

      {showProgress ? (
        <RunProgress schema={schema} state={run.state} furthest={run.furthest} />
      ) : null}

      <Card
        size="small"
        title={
          <Space size={6}>
            {run.node ? nodeCaption(run.node) : 'Run'}
            {/* Says why anything reporting the run shows more than the step does. */}
            {run.canGoForward ? <Tag>Reviewing an earlier step</Tag> : null}
          </Space>
        }
        extra={
          showControls ? (
            <Space size={4}>
              <Button
                size="small"
                icon={<ArrowLeftOutlined />}
                disabled={!run.canGoBack}
                onClick={run.back}
              >
                Back
              </Button>
              {/* Navigation, not submission: it returns to the step the run had
                  reached, which exists precisely because it was answered. An edit
                  made on a step you came back to takes effect when you submit
                  that step — which is also what puts the run back on the branch
                  it belongs on. */}
              <Tooltip title="Return to the step this run reached. Submit to keep an edit.">
                <Button
                  size="small"
                  icon={<ArrowRightOutlined />}
                  disabled={!run.canGoForward}
                  onClick={run.forward}
                >
                  Forward
                </Button>
              </Tooltip>
              <Button size="small" icon={<ReloadOutlined />} onClick={run.restart}>
                Restart
              </Button>
            </Space>
          ) : null
        }
      >
        <WorkflowStepView
          state={run.state}
          node={run.node}
          values={run.values}
          stepKey={run.stepKey}
          formSources={run.formSources}
          onStep={run.step}
          onAction={onAction}
        />
      </Card>
    </Space>
  );
}
