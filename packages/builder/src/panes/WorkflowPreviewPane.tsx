import { ArrowLeftOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Result,
  Row,
  Space,
  Steps,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { edgeCaption } from '../workflow/conditionText';
import { ScreenRenderer } from '@antd-form-generator/core/renderer/ScreenRenderer';
import type { WorkflowRunState } from '@antd-form-generator/core/renderer/workflow/engine';
import { advanceWorkflow, describeBlock, startWorkflow } from '@antd-form-generator/core/renderer/workflow/engine';
import type { ScreenSchema } from '@antd-form-generator/core/schema/screen';
import { collectScreenActions, screenCollectsValues } from '@antd-form-generator/core/schema/screen';
import type { WorkflowSchema } from '@antd-form-generator/core/schema/workflow';
import { findWorkflowNode, validateWorkflow, workflowStages } from '@antd-form-generator/core/schema/workflowGraph';
import { nodeCaption, workflowMetaFor } from '@antd-form-generator/core/schema/workflowRegistry';
import { jsonReplacer } from './jsonReplacer';

export interface WorkflowPreviewPaneProps {
  schema: WorkflowSchema;
}

/**
 * How far along the run is — the wizard's "step 3 of 5".
 *
 * Driven entirely by the graph, so there is nothing to author and nothing that
 * can drift out of step with the flow. That is why this is not a screen node:
 * a `steps` block dropped onto a screen would have to be maintained by hand and
 * could not see the run anyway.
 *
 * A stage the run has actually visited is captioned with the step it took,
 * because that is known. One it has not is captioned generically when the
 * branches diverge — the graph cannot say which of two routes the reader will
 * be sent down, and guessing would be worse than admitting it.
 */
function RunProgress({ schema, state }: { schema: WorkflowSchema; state: WorkflowRunState }) {
  const stages = useMemo(() => workflowStages(schema), [schema]);
  if (stages.length < 2) return null;

  const visited = new Set(state.trace);
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

/**
 * The workflow, actually run: the current step on the left, what it has
 * collected on the right.
 *
 * Every step pushes a whole `WorkflowRunState` onto a stack rather than
 * recording how to undo itself — the same reasoning `src/store/history.ts`
 * gives, and a run state is small enough that the copy costs nothing.
 */
export function WorkflowPreviewPane({ schema }: WorkflowPreviewPaneProps) {
  const [history, setHistory] = useState<WorkflowRunState[]>(() => [startWorkflow(schema)]);
  const state = history[history.length - 1];

  // A run holds node and edge ids, so it only means anything against the
  // document it started from. Loading a sample, importing, an Undo or a JSON
  // edit all replace that document — and a run left pointing at ids that no
  // longer exist reports "nothing to run" instead of starting over.
  const ranAgainst = useRef(schema);
  useEffect(() => {
    if (ranAgainst.current === schema) return;
    ranAgainst.current = schema;
    setHistory([startWorkflow(schema)]);
  }, [schema]);

  const errors = useMemo(
    () => validateWorkflow(schema).filter((issue) => issue.level === 'error'),
    [schema],
  );

  // A `summary` node names the step it lays out, so the run has to hand the
  // schemas over — a payload alone carries no layout.
  const formSources = useMemo(() => {
    const sources: Record<string, ScreenSchema> = {};
    for (const node of schema.nodes) {
      if (node.kind === 'screen' && node.screen) sources[node.id] = node.screen;
    }
    return sources;
  }, [schema.nodes]);

  const step = (contribution?: Record<string, unknown>) =>
    setHistory((entries) => [...entries, advanceWorkflow(schema, entries[entries.length - 1], contribution)]);

  const node = state.nodeId ? findWorkflowNode(schema, state.nodeId) : null;

  return (
    <Row gutter={16} style={{ padding: 16, height: 'calc(100vh - 100px)' }}>
      <Col xs={24} lg={14}>
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

          <RunProgress schema={schema} state={state} />

          <Card
            size="small"
            title={node ? nodeCaption(node) : 'Run'}
            extra={
              <Space size={4}>
                <Button
                  size="small"
                  icon={<ArrowLeftOutlined />}
                  disabled={history.length < 2}
                  onClick={() => setHistory((entries) => entries.slice(0, -1))}
                >
                  Back
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => setHistory([startWorkflow(schema)])}
                >
                  Restart
                </Button>
              </Space>
            }
          >
            <StepBody schema={schema} state={state} onStep={step} formSources={formSources} />
          </Card>
        </Space>
      </Col>

      <Col xs={24} lg={10}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small" title="Collected so far">
            {Object.keys(state.values).length > 0 ? (
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
                {JSON.stringify(state.values, jsonReplacer, 2)}
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

          <Card size="small" title="Path taken">
            <RunTrace schema={schema} state={state} />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

/** What the current node asks of the person driving the run. */
function StepBody({
  schema,
  state,
  onStep,
  formSources,
}: {
  schema: WorkflowSchema;
  state: WorkflowRunState;
  onStep: (contribution?: Record<string, unknown>) => void;
  formSources: Record<string, ScreenSchema>;
}) {
  const node = state.nodeId ? findWorkflowNode(schema, state.nodeId) : null;

  if (state.status === 'blocked') {
    return (
      <Alert
        type="warning"
        showIcon
        title="The run stopped here"
        description={
          <>
            <Typography.Paragraph style={{ marginBottom: 4 }}>
              {describeBlock(state.blocked?.reason ?? 'no-match')}
            </Typography.Paragraph>
            {node ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Last step: {nodeCaption(node)}
              </Typography.Text>
            ) : null}
          </>
        }
      />
    );
  }

  if (!node) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing to run" />;
  }

  if (state.status === 'done') {
    return (
      <Result
        status="success"
        title={nodeCaption(node)}
        subTitle={node.description || 'The run finished here.'}
      />
    );
  }

  if (node.kind === 'screen') {
    if (!node.screen || node.screen.nodes.length === 0) {
      return (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="This step is empty" />
          <Button type="primary" onClick={() => onStep()}>
            Skip this step
          </Button>
        </Space>
      );
    }

    const actions = collectScreenActions(node.screen);
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {/* Keyed by node so a loop back to a step it already visited gets a
            fresh form instance; `values` is what puts the earlier answers back
            into it. */}
        <ScreenRenderer
          key={node.id}
          schema={node.screen}
          values={state.values}
          formSources={formSources}
          onSubmit={(submitted) => onStep(submitted)}
          // A button is an outcome carrying whatever the screen also collected:
          // the same merge an approval does, which is why a branch tests it
          // with an ordinary condition.
          onAction={(actionId, collected) =>
            onStep({ ...collected, [node.name || 'choice']: actionId })
          }
        />
        {actions.length === 0 && !screenCollectsValues(node.screen) ? (
          // Nothing to submit and no button to press — the validator warns
          // about this, but a run that hit it still needs a way out.
          <Button type="primary" onClick={() => onStep()}>
            Continue
          </Button>
        ) : null}
      </Space>
    );
  }

  if (node.kind === 'approval') {
    const outcomes = node.outcomes ?? [];
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {node.description || 'Pick an outcome. It is stored as'}{' '}
          <Typography.Text code>{node.name || 'decision'}</Typography.Text>
          {' — that is what the branches below this step test.'}
        </Typography.Text>
        <Space wrap>
          {outcomes.map((outcome) => (
            <Button
              key={outcome.id}
              type={outcome.danger ? 'default' : 'primary'}
              danger={outcome.danger}
              onClick={() => onStep({ [node.name || 'decision']: outcome.id })}
            >
              {outcome.label || outcome.id}
            </Button>
          ))}
          {outcomes.length === 0 ? (
            <Typography.Text type="warning">
              This approval has no outcomes, so it cannot be answered.
            </Typography.Text>
          ) : null}
        </Space>
      </Space>
    );
  }

  if (node.kind === 'action') {
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {node.description ||
            'The app embedding this workflow handles this step. The document carries the intent only.'}
        </Typography.Paragraph>
        <Space size={6} wrap>
          <Tag>{node.action?.id || 'no action id'}</Tag>
          {Object.entries(node.action?.params ?? {}).map(([key, value]) => (
            <Tag key={key}>
              {key}={value}
            </Tag>
          ))}
        </Space>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => onStep()}>
          {node.action?.label || 'Continue'}
        </Button>
      </Space>
    );
  }

  // `start` and `decision` are chained through by the engine, so reaching one
  // here means the graph changed under a running preview.
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text type="secondary">{node.description || 'Nothing to answer here.'}</Typography.Text>
      <Button type="primary" onClick={() => onStep()}>
        Continue
      </Button>
    </Space>
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
