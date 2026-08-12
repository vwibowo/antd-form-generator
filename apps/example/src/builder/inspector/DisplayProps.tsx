import { DeleteOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Segmented, Select, Switch, Typography } from 'antd';
import type { DataListItem, ScreenAction, ScreenNode, ScreenSchema } from '@antd-form-generator/core/schema/screen';
import { metaFor } from '@antd-form-generator/core/schema/registry';
import { useTableStore } from '@/store/useTableStore';
import { Labeled } from './Labeled';

/**
 * The inspector controls for nodes that show something rather than ask for it.
 *
 * These were the whole of `BlockInspector` when a page was its own document.
 * They live beside the control editors now and are gated by the same
 * `supports` flags `index.tsx` already uses, so a heading and a text input are
 * configured by one panel.
 */

export interface DisplayPropsProps {
  node: ScreenNode;
  onPatch: (patch: Partial<ScreenNode>) => void;
  /** Screens an earlier step collected, so a `summary` node can lay one out. */
  formSources?: Record<string, ScreenSchema>;
  /** Labels for those steps, so the picker reads as node names not ids. */
  formLabels?: Record<string, string>;
}

function DataItemsEditor({
  items,
  onChange,
}: {
  items: DataListItem[];
  onChange: (items: DataListItem[]) => void;
}) {
  const replace = (index: number, patch: Partial<DataListItem>) =>
    onChange(items.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item, index) => (
        <div key={index} className="fg-wf-outcome">
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              size="small"
              value={item.label}
              placeholder="Label"
              onChange={(event) => replace(index, { label: event.target.value })}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Remove row"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
          <Input
            size="small"
            value={item.value}
            placeholder="{{fieldName}}"
            onChange={(event) => replace(index, { value: event.target.value })}
          />
        </div>
      ))}
      <Button
        size="small"
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => onChange([...items, { label: '', value: '' }])}
      >
        Add row
      </Button>
    </div>
  );
}

function ActionsEditor({
  actions,
  onChange,
}: {
  actions: ScreenAction[];
  onChange: (actions: ScreenAction[]) => void;
}) {
  const replace = (index: number, patch: Partial<ScreenAction>) =>
    onChange(actions.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {actions.map((action, index) => (
        <div key={index} className="fg-wf-outcome">
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              size="small"
              value={action.label}
              placeholder="Button text"
              onChange={(event) => replace(index, { label: event.target.value })}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Remove button"
              onClick={() => onChange(actions.filter((_, i) => i !== index))}
            />
          </div>
          <Input
            size="small"
            value={action.id}
            placeholder="Value stored in the payload"
            onChange={(event) => replace(index, { id: event.target.value })}
          />
          <Select
            size="small"
            value={action.variant}
            options={[
              { label: 'Primary', value: 'primary' },
              { label: 'Default', value: 'default' },
              { label: 'Dashed', value: 'dashed' },
              { label: 'Link', value: 'link' },
              { label: 'Text', value: 'text' },
            ]}
            onChange={(variant) => replace(index, { variant })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              size="small"
              checked={action.danger}
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
        onClick={() =>
          onChange([...actions, { id: '', label: '', variant: 'default', danger: false }])
        }
      >
        Add button
      </Button>
    </div>
  );
}

/**
 * A table node's source.
 *
 * Table mode is the table editor; nesting a second full one inside this panel
 * would mean giving `useTableStore` the factory-and-context treatment
 * `useScreenStore` got, for a node most screens will not use. Copying the
 * document across is the honest small version, and the JSON tab remains
 * available for hand-authoring.
 */
export function EmbeddedTableEditor({
  node,
  onPatch,
}: {
  node: ScreenNode;
  onPatch: (patch: Partial<ScreenNode>) => void;
}) {
  const tableSchema = useTableStore((state) => state.schema);
  const columns = node.table?.columns.length ?? 0;
  const rows = node.table?.source.rows.length ?? 0;

  return (
    <div>
      <Labeled label="This node's table">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {columns} column{columns === 1 ? '' : 's'}, {rows} inline row{rows === 1 ? '' : 's'}
          {node.table?.source.kind === 'remote' ? ', fetched remotely' : ''}
        </Typography.Text>
      </Labeled>

      <Button
        size="small"
        block
        icon={<TableOutlined />}
        disabled={tableSchema.columns.length === 0}
        onClick={() => onPatch({ table: structuredClone(tableSchema) })}
      >
        Copy from Table mode ({tableSchema.columns.length} columns)
      </Button>

      <Typography.Paragraph type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
        Build it in Table mode, then copy it here. This takes a snapshot — later edits to the table
        document do not follow it.
      </Typography.Paragraph>
    </div>
  );
}

export function DisplayProps({ node, onPatch, formSources = {}, formLabels = {} }: DisplayPropsProps) {
  const meta = metaFor(node.type);
  const setProp = (key: string, value: unknown) =>
    onPatch({ props: { ...node.props, [key]: value } });

  return (
    <>
      {meta.supports.text ? (
        <Labeled label="Text" help="{{fieldName}} is filled in from the payload.">
          <Input.TextArea
            size="small"
            rows={node.type === 'heading' ? 2 : 4}
            value={node.text}
            onChange={(event) => onPatch({ text: event.target.value })}
          />
        </Labeled>
      ) : null}

      {node.type === 'heading' ? (
        <Labeled label="Level">
          <Segmented
            size="small"
            block
            value={typeof node.props.level === 'number' ? node.props.level : 3}
            options={[1, 2, 3, 4, 5].map((level) => ({ label: `H${level}`, value: level }))}
            onChange={(level) => setProp('level', level)}
          />
        </Labeled>
      ) : null}

      {node.type === 'alert' ? (
        <Labeled label="Tone">
          <Segmented
            size="small"
            block
            value={typeof node.props.tone === 'string' ? node.props.tone : 'info'}
            options={[
              { label: 'Info', value: 'info' },
              { label: 'Good', value: 'success' },
              { label: 'Warn', value: 'warning' },
              { label: 'Error', value: 'error' },
            ]}
            onChange={(tone) => setProp('tone', tone)}
          />
        </Labeled>
      ) : null}

      {meta.supports.image ? (
        <>
          <Labeled label="Image URL" help="http(s) only. Takes {{fieldName}} too.">
            <Input
              size="small"
              value={node.src}
              placeholder="https://…"
              onChange={(event) => onPatch({ src: event.target.value })}
            />
          </Labeled>
          <Labeled label="Alt text" help="What a screen reader announces.">
            <Input
              size="small"
              value={node.alt}
              onChange={(event) => onPatch({ alt: event.target.value })}
            />
          </Labeled>
        </>
      ) : null}

      {meta.supports.items ? (
        <Labeled label="Rows">
          <DataItemsEditor items={node.items ?? []} onChange={(items) => onPatch({ items })} />
        </Labeled>
      ) : null}

      {meta.supports.actions ? (
        <>
          <Labeled
            label="Buttons"
            help="Each button's stored value is what a workflow branch tests for."
          >
            <ActionsEditor
              actions={node.actions ?? []}
              onChange={(actions) => onPatch({ actions })}
            />
          </Labeled>
          <Labeled label="Align">
            <Segmented
              size="small"
              block
              value={typeof node.props.align === 'string' ? node.props.align : 'left'}
              options={[
                { label: 'Left', value: 'left' },
                { label: 'Centre', value: 'center' },
                { label: 'Right', value: 'right' },
              ]}
              onChange={(align) => setProp('align', align)}
            />
          </Labeled>
        </>
      ) : null}

      {meta.supports.summarySource ? (
        <Labeled
          label="Summarise which step"
          help={
            Object.keys(formSources).length === 0
              ? 'Available once this screen sits in a workflow with an earlier screen step.'
              : 'The screen whose fields lay the payload out.'
          }
        >
          <Select
            size="small"
            style={{ width: '100%' }}
            allowClear
            value={node.summarySource}
            placeholder="Pick a screen step"
            options={Object.keys(formSources).map((id) => ({
              label: formLabels[id] ?? id,
              value: id,
            }))}
            onChange={(summarySource) => onPatch({ summarySource })}
          />
        </Labeled>
      ) : null}

      {node.type === 'spacer' ? (
        <Labeled label="Height">
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            min={4}
            max={200}
            value={typeof node.props.height === 'number' ? node.props.height : 24}
            onChange={(height) => setProp('height', height ?? 24)}
          />
        </Labeled>
      ) : null}

      {node.type === 'dataList' || node.type === 'summary' ? (
        <>
          <Labeled label="Columns">
            <Segmented
              size="small"
              block
              value={typeof node.props.columns === 'number' ? node.props.columns : 1}
              options={[1, 2, 3].map((columns) => ({ label: String(columns), value: columns }))}
              onChange={(columns) => setProp('columns', columns)}
            />
          </Labeled>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Switch
              size="small"
              checked={node.props.bordered !== false}
              onChange={(bordered) => setProp('bordered', bordered)}
            />
            <Typography.Text style={{ fontSize: 13 }}>Bordered</Typography.Text>
          </div>
        </>
      ) : null}
    </>
  );
}
