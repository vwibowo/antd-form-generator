import { ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Row, Space, Tag, Timeline, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { edgeCaption } from '../workflow/conditionText';
import type { WorkflowRunState } from '@antd-form-generator/core/renderer/workflow/engine';
import { RunProgress } from '@antd-form-generator/core/renderer/workflow/RunProgress';
import { useWorkflowRun } from '@antd-form-generator/core/renderer/workflow/useWorkflowRun';
import { WorkflowStepView } from '@antd-form-generator/core/renderer/workflow/WorkflowStepView';
import type { WorkflowSchema } from '@antd-form-generator/core/schema/workflow';
import { findWorkflowNode, validateWorkflow } from '@antd-form-generator/core/schema/workflowGraph';
import { nodeCaption, workflowMetaFor } from '@antd-form-generator/core/schema/workflowRegistry';
import { usePreviewSideStore } from '../store/usePreviewSideStore';
import { SidePanelToggle } from './SidePanelToggle';
import { jsonReplacer } from './jsonReplacer';

export interface WorkflowPreviewPaneProps {
  schema: WorkflowSchema;
}

/**
 * The workflow, actually run: the current step on the left, and — once you ask
 * for it — what the run has collected and how it got there on the right.
 *
 * That column is opt-in and starts closed, so driving a flow gets the full
 * width. One toggle covers both its cards: what has been collected and which
 * route produced it are two halves of one answer, and reading either alone tells
 * you very little, so there is nothing to gain from hiding them separately.
 *
 * Every step pushes a whole `WorkflowRunState` onto a stack rather than
 * recording how to undo itself — the same reasoning `src/store/history.ts`
 * gives, and a run state is small enough that the copy costs nothing.
 */
export function WorkflowPreviewPane({ schema }: WorkflowPreviewPaneProps) {
  // The run itself is core's now — the builder's preview is one host of it,
  // which is the point. What stays here is the authoring furniture a host has no
  // use for: the trace timeline, and the side panel it shares with the other
  // two previews.
  const run = useWorkflowRun(schema);
  const { state, furthest, node, values, stepKey, formSources } = run;
  const shown = usePreviewSideStore((entry) => entry.shown.workflow);

  const errors = useMemo(
    () => validateWorkflow(schema).filter((issue) => issue.level === 'error'),
    [schema],
  );

  return (
    <Row gutter={16} style={{ padding: 16, height: 'calc(100vh - 100px)' }}>
      <Col xs={24} lg={shown ? 14 : 24}>
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

          <RunProgress schema={schema} state={state} furthest={furthest} />

          <Card
            size="small"
            title={
              <Space size={6}>
                {node ? nodeCaption(node) : 'Run'}
                {/* Says why the column beside this shows more than the step does. */}
                {run.canGoForward ? <Tag>Reviewing an earlier step</Tag> : null}
              </Space>
            }
            extra={
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
                    reached, which exists precisely because it was answered. An
                    edit made on a step you came back to takes effect when you
                    submit that step — which is also what puts the run back on the
                    branch it belongs on. */}
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
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={run.restart}
                >
                  Restart
                </Button>
                {/* Last: the run controls are what you came here to press, and
                    this only changes how much of the window they get. */}
                <SidePanelToggle panel="workflow" label="Run details" />
              </Space>
            }
          >
            <WorkflowStepView
              state={state}
              node={node}
              values={values}
              stepKey={stepKey}
              formSources={formSources}
              onStep={run.step}
            />
          </Card>
        </Space>
      </Col>

      {shown ? (
        <Col xs={24} lg={10}>
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {/* The run's payload, not the cursor's. `history[cursor].values`
                holds what was known on the way *into* that step, so stepping
                back to the first one would empty this panel — indistinguishable
                from the answer having been lost, which is the very bug the
                cursor exists to fix. The card on the left says where you are;
                this says what the run has. */}
            <Card size="small" title="Collected so far">
              {Object.keys(furthest.values).length > 0 ? (
                <pre
                  data-testid="workflow-values"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(furthest.values, jsonReplacer, 2)}
                </pre>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Typography.Text type="secondary">
                      Answer a step to see the payload the branches read
                    </Typography.Text>
                  }
                />
              )}
            </Card>

            {/* Furthest for the same reason, and because the two cards are two
                halves of one answer — a payload from one moment beside a route
                from another explains nothing. */}
            <Card size="small" title="Path taken">
              <RunTrace schema={schema} state={furthest} />
            </Card>
          </Space>
        </Col>
      ) : null}
    </Row>
  );
}

/** Steps visited and the branch taken out of each, newest last. */
function RunTrace({ schema, state }: { schema: WorkflowSchema; state: WorkflowRunState }) {
  if (state.trace.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        The run has not started.
      </Typography.Text>
    );
  }

  return (
    <Timeline
      items={state.trace.map((nodeId, index) => {
        const node = findWorkflowNode(schema, nodeId);
        const edgeId = state.taken[index];
        const edge = edgeId ? schema.edges.find((entry) => entry.id === edgeId) : undefined;
        const via = edge ? edgeCaption(edge.label, edge.condition, edge.isDefault) : '';

        return {
          color: node ? workflowMetaFor(node.kind).color : '#8c8c8c',
          // `content`, not `children`: antd 6 deprecates the latter on Timeline.
          content: (
            <div>
              <Typography.Text style={{ fontSize: 13 }}>
                {node ? nodeCaption(node) : nodeId}
              </Typography.Text>
              {via ? (
                <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  via {via}
                </Typography.Text>
              ) : null}
            </div>
          ),
        };
      })}
    />
  );
}
