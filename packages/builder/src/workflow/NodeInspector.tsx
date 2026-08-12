import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Switch, Typography } from 'antd';
import type { ApprovalOutcome, WorkflowNode } from '@antd-form-generator/core/schema/workflow';
import { workflowMetaFor } from '@antd-form-generator/core/schema/workflowRegistry';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { Labeled } from '../inspector/Labeled';

export interface NodeInspectorProps {
  node: WorkflowNode;
  /** Open the builder on this node's embedded screen. */
  onEditScreen: (id: string) => void;
}

/** Approve/reject style choices — what an approval writes into the payload. */
function OutcomeEditor({
  outcomes,
  onChange,
}: {
  outcomes: ApprovalOutcome[];
  onChange: (outcomes: ApprovalOutcome[]) => void;
}) {
  const replace = (index: number, patch: Partial<ApprovalOutcome>) =>
    onChange(outcomes.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {outcomes.map((outcome, index) => (
        <div key={index} className="fg-wf-outcome">
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              size="small"
              value={outcome.label}
              placeholder="Button text"
              onChange={(event) => replace(index, { label: event.target.value })}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Remove outcome"
              onClick={() => onChange(outcomes.filter((_, i) => i !== index))}
            />
          </div>
          <Input
            size="small"
            value={outcome.id}
            placeholder="Value stored in the payload"
            onChange={(event) => replace(index, { id: event.target.value })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              size="small"
              checked={outcome.danger}
              onChange={(danger) => replace(index, { danger })}
            />
            <Typography.Text style={{ fontSize: 12 }}>Show in red</Typography.Text>
          </div>
        </div>
      ))}

      <Button
        size="small"
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => onChange([...outcomes, { id: '', label: '', danger: false }])}
      >
        Add outcome
      </Button>
    </div>
  );
}

export function NodeInspector({ node, onEditScreen }: NodeInspectorProps) {
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const meta = workflowMetaFor(node.kind);

  const patch = (next: Partial<WorkflowNode>) => updateNode(node.id, next);

  return (
    <div style={{ padding: 12 }}>
      <Labeled label="Name on the canvas">
        <Input
          size="small"
          value={node.label}
          placeholder={meta.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Labeled>

      <Labeled label="Description">
        <Input.TextArea
          size="small"
          rows={2}
          value={node.description}
          placeholder={meta.hint}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </Labeled>

      {meta.supports.holdsScreen ? (
        <Labeled
          label="Contents"
          help="Everything this step collects lands in one shared payload, and its buttons are what branches out of it test — both live on the screen."
        >
          <Button size="small" block icon={<EditOutlined />} onClick={() => onEditScreen(node.id)}>
            Edit screen ({node.screen?.nodes.length ?? 0} nodes)
          </Button>
        </Labeled>
      ) : null}

      {meta.supports.carriesName ? (
        <>
          <Labeled
            label="Payload key"
            help={
              node.kind === 'screen'
                ? 'The pressed button is stored here, so a branch can test it by name.'
                : 'The chosen outcome is stored here, so a branch can test it by name.'
            }
          >
            <Input
              size="small"
              value={node.name}
              placeholder={meta.namePrefix}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Labeled>

          {/* An approval's outcomes are buttons on the node; a page's are
              buttons in an `actions` block, edited with the page itself. */}
          {node.kind === 'approval' ? (
            <Labeled label="Outcomes">
              <OutcomeEditor
                outcomes={node.outcomes ?? []}
                onChange={(outcomes) => patch({ outcomes })}
              />
            </Labeled>
          ) : null}
        </>
      ) : null}

      {node.kind === 'action' ? (
        <>
          <Labeled
            label="Action id"
            help="Handed to the app embedding this workflow. The document describes the intent only — it never carries code."
          >
            <Input
              size="small"
              value={node.action?.id ?? ''}
              placeholder="expense.payOut"
              onChange={(event) =>
                patch({ action: { ...(node.action ?? { label: '', params: {} }), id: event.target.value } })
              }
            />
          </Labeled>
          <Labeled label="Button text">
            <Input
              size="small"
              value={node.action?.label ?? ''}
              placeholder="Run this step"
              onChange={(event) =>
                patch({ action: { ...(node.action ?? { id: '', params: {} }), label: event.target.value } })
              }
            />
          </Labeled>
        </>
      ) : null}

      {node.kind === 'decision' ? (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          A decision asks nothing. Give its outgoing branches conditions, and a run passes straight
          through to whichever matches first.
        </Typography.Text>
      ) : null}
    </div>
  );
}
