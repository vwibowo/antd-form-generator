import { ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { ScreenSchema } from '../../schema/screen';
import { collectScreenActions, screenCollectsValues } from '../../schema/screen';
import type { NodeAction, WorkflowNode } from '../../schema/workflow';
import { nodeCaption } from '../../schema/workflowRegistry';
import { ScreenRenderer } from '../ScreenRenderer';
import type { WorkflowRunState } from './engine';
import { describeBlock } from './engine';

export interface WorkflowStepViewProps {
  state: WorkflowRunState;
  /** The node the run is waiting on, already resolved from the graph. */
  node: WorkflowNode | null;
  /** What to open a screen step with. */
  values: Record<string, unknown>;
  /** Form identity for this step at this position. */
  stepKey: string;
  formSources: Record<string, ScreenSchema>;
  onStep: (contribution?: Record<string, unknown>) => void;
  /**
   * An `action` node was reached and the reader pressed its button.
   *
   * Without this the document carries an intent nothing can execute: the node
   * names something the host is supposed to do — open an account, page an
   * engineer — and the renderer could only draw it and move on. Awaited, so a
   * host can do the work and have the run wait; throwing leaves the run where it
   * is rather than advancing past an action that failed.
   */
  onAction?: (action: NodeAction, node: WorkflowNode) => void | Promise<void>;
}

/**
 * What the current node asks of the person driving the run.
 *
 * One branch per node kind. `start` and `decision` never reach here in a healthy
 * run — the engine chains through them — so the fallback exists for a graph that
 * changed underneath a live run.
 */
export function WorkflowStepView({
  state,
  node,
  values,
  stepKey,
  formSources,
  onStep,
  onAction,
}: WorkflowStepViewProps) {
  const [running, setRunning] = useState(false);

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
        {/* Keyed by step *and position* so navigating always gets a fresh form
            instance; `values` is what puts the earlier answers back into it. The
            position matters because `values` is not controlled — once the form
            store holds a key, re-seeding cannot overwrite it, so a graph that
            loops to the same node id would otherwise keep a form full of the
            previous visit's edits. */}
        <ScreenRenderer
          key={stepKey}
          schema={node.screen}
          values={values}
          formSources={formSources}
          onSubmit={(submitted) => onStep(submitted)}
          // A button is an outcome carrying whatever the screen also collected:
          // the same merge an approval does, which is why a branch tests it with
          // an ordinary condition.
          onAction={(actionId, collected) =>
            onStep({ ...collected, [node.name || 'choice']: actionId })
          }
        />
        {actions.length === 0 && !screenCollectsValues(node.screen) ? (
          // Nothing to submit and no button to press — the validator warns about
          // this, but a run that hit it still needs a way out.
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
    const press = async () => {
      if (!onAction) {
        onStep();
        return;
      }
      setRunning(true);
      try {
        await onAction(node.action ?? { id: '', label: '', params: {} }, node);
        onStep();
      } finally {
        // The run stays put if the host threw: advancing past an action that did
        // not happen would put the payload out of step with the world.
        setRunning(false);
      }
    };

    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {node.description ||
            (onAction
              ? 'The app embedding this workflow handles this step.'
              : 'The app embedding this workflow handles this step. The document carries the intent only.')}
        </Typography.Paragraph>
        <Space size={6} wrap>
          <Tag>{node.action?.id || 'no action id'}</Tag>
          {Object.entries(node.action?.params ?? {}).map(([key, value]) => (
            <Tag key={key}>
              {key}={value}
            </Tag>
          ))}
        </Space>
        <Button type="primary" icon={<ThunderboltOutlined />} loading={running} onClick={press}>
          {node.action?.label || 'Continue'}
        </Button>
      </Space>
    );
  }

  // `start` and `decision` are chained through by the engine, so reaching one
  // here means the graph changed under a running preview.
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text type="secondary">
        {node.description || 'Nothing to answer here.'}
      </Typography.Text>
      <Button type="primary" onClick={() => onStep()}>
        Continue
      </Button>
    </Space>
  );
}
