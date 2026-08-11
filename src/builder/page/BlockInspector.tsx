import { DeleteOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Collapse, Empty, Input, InputNumber, Segmented, Select, Switch, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import type { PageAction, PageBlock, PageDataItem } from '@/schema/page';
import { pageBlockMetaFor } from '@/schema/pageRegistry';
import type { FormSchema } from '@/schema/schema';
import { usePageBuilderStore } from '@/store/PageStoreContext';
import { useTableStore } from '@/store/useTableStore';
import { ConditionEditor } from '../inspector/ConditionEditor';
import { Labeled } from '../inspector/Labeled';
import { PageSettings } from './PageSettings';

export interface BlockInspectorProps {
  /**
   * Payload keys a condition or a `{{token}}` can reach. Empty for a standalone
   * page, which is why `ConditionEditor` has to accept a typed name.
   */
  fieldChoices?: { label: string; value: string }[];
  /** Form steps a `summary` block can lay out, when inside a workflow. */
  formSources?: Record<string, FormSchema>;
  /** Labels for those steps, so the picker reads as node names not ids. */
  formLabels?: Record<string, string>;
}

const SPAN_OPTIONS = [
  { label: 'Full', value: 24 },
  { label: '1/2', value: 12 },
  { label: '1/3', value: 8 },
  { label: '2/3', value: 16 },
];

function DataItemsEditor({
  items,
  onChange,
}: {
  items: PageDataItem[];
  onChange: (items: PageDataItem[]) => void;
}) {
  const replace = (index: number, patch: Partial<PageDataItem>) =>
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
  actions: PageAction[];
  onChange: (actions: PageAction[]) => void;
}) {
  const replace = (index: number, patch: Partial<PageAction>) =>
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
 * A table block's source.
 *
 * Table mode is the table editor; nesting a second full one inside this panel
 * would mean giving `useTableStore` the factory-and-context treatment
 * `useSchemaStore` got, for a block most pages will not use. Copying the
 * document across is the honest small version, and the JSON tab remains
 * available for hand-authoring.
 */
function EmbeddedTableEditor({
  block,
  onPatch,
}: {
  block: PageBlock;
  onPatch: (patch: Partial<PageBlock>) => void;
}) {
  const tableSchema = useTableStore((state) => state.schema);
  const columns = block.table?.columns.length ?? 0;
  const rows = block.table?.source.rows.length ?? 0;

  return (
    <div>
      <Labeled label="This block's table">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {columns} column{columns === 1 ? '' : 's'}, {rows} inline row{rows === 1 ? '' : 's'}
          {block.table?.source.kind === 'remote' ? ', fetched remotely' : ''}
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

export function BlockInspector({
  fieldChoices = [],
  formSources = {},
  formLabels = {},
}: BlockInspectorProps) {
  const schema = usePageBuilderStore((state) => state.schema);
  const selectedId = usePageBuilderStore((state) => state.selectedId);
  const updateBlock = usePageBuilderStore((state) => state.updateBlock);

  const selected = useMemo<PageBlock | null>(
    () => schema.blocks.find((block) => block.id === selectedId) ?? null,
    [schema.blocks, selectedId],
  );

  if (!selected) {
    return (
      <div className="fg-scroll" style={{ height: '100%', padding: 12 }}>
        <PageSettings />
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Select a block to edit it
            </Typography.Text>
          }
          style={{ marginTop: 24 }}
        />
      </div>
    );
  }

  const meta = pageBlockMetaFor(selected.type);
  const patch = (next: Partial<PageBlock>) => updateBlock(selected.id, next);
  const setProp = (key: string, value: unknown) =>
    patch({ props: { ...selected.props, [key]: value } });

  const general = (
    <div>
      {meta.supports.text ? (
        <Labeled label="Text" help="{{fieldName}} is filled in from the payload.">
          <Input.TextArea
            size="small"
            rows={selected.type === 'heading' ? 2 : 4}
            value={selected.text}
            onChange={(event) => patch({ text: event.target.value })}
          />
        </Labeled>
      ) : null}

      {selected.type === 'heading' ? (
        <Labeled label="Level">
          <Segmented
            size="small"
            block
            value={typeof selected.props.level === 'number' ? selected.props.level : 3}
            options={[1, 2, 3, 4, 5].map((level) => ({ label: `H${level}`, value: level }))}
            onChange={(level) => setProp('level', level)}
          />
        </Labeled>
      ) : null}

      {selected.type === 'alert' ? (
        <Labeled label="Tone">
          <Segmented
            size="small"
            block
            value={typeof selected.props.tone === 'string' ? selected.props.tone : 'info'}
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
              value={selected.src}
              placeholder="https://…"
              onChange={(event) => patch({ src: event.target.value })}
            />
          </Labeled>
          <Labeled label="Alt text" help="What a screen reader announces.">
            <Input
              size="small"
              value={selected.alt}
              onChange={(event) => patch({ alt: event.target.value })}
            />
          </Labeled>
        </>
      ) : null}

      {meta.supports.items ? (
        <Labeled label="Rows">
          <DataItemsEditor
            items={selected.items ?? []}
            onChange={(items) => patch({ items })}
          />
        </Labeled>
      ) : null}

      {meta.supports.actions ? (
        <>
          <Labeled
            label="Buttons"
            help="Each button's stored value is what a workflow branch tests for."
          >
            <ActionsEditor
              actions={selected.actions ?? []}
              onChange={(actions) => patch({ actions })}
            />
          </Labeled>
          <Labeled label="Align">
            <Segmented
              size="small"
              block
              value={typeof selected.props.align === 'string' ? selected.props.align : 'left'}
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
              ? 'Available once this page sits in a workflow that has a form step.'
              : 'The form whose fields lay the payload out.'
          }
        >
          <Select
            size="small"
            style={{ width: '100%' }}
            allowClear
            value={selected.summarySource}
            placeholder="Pick a form step"
            options={Object.keys(formSources).map((id) => ({
              label: formLabels[id] ?? id,
              value: id,
            }))}
            onChange={(summarySource) => patch({ summarySource })}
          />
        </Labeled>
      ) : null}

      {selected.type === 'spacer' ? (
        <Labeled label="Height">
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            min={4}
            max={200}
            value={typeof selected.props.height === 'number' ? selected.props.height : 24}
            onChange={(height) => setProp('height', height ?? 24)}
          />
        </Labeled>
      ) : null}

      {selected.type === 'dataList' || selected.type === 'summary' ? (
        <>
          <Labeled label="Columns">
            <Segmented
              size="small"
              block
              value={typeof selected.props.columns === 'number' ? selected.props.columns : 1}
              options={[1, 2, 3].map((columns) => ({ label: String(columns), value: columns }))}
              onChange={(columns) => setProp('columns', columns)}
            />
          </Labeled>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Switch
              size="small"
              checked={selected.props.bordered !== false}
              onChange={(bordered) => setProp('bordered', bordered)}
            />
            <Typography.Text style={{ fontSize: 13 }}>Bordered</Typography.Text>
          </div>
        </>
      ) : null}

      <Labeled label={`Width — ${selected.span}/24`}>
        <Select
          size="small"
          style={{ width: '100%' }}
          value={selected.span}
          options={SPAN_OPTIONS}
          onChange={(span) => patch({ span })}
        />
      </Labeled>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          size="small"
          checked={selected.hidden}
          onChange={(hidden) => patch({ hidden })}
        />
        <Typography.Text style={{ fontSize: 13 }}>Hidden</Typography.Text>
      </div>
    </div>
  );

  const items = [
    { key: 'general', label: 'General', children: general },
    {
      key: 'visibility',
      label: 'Visibility',
      children: (
        <ConditionEditor
          condition={selected.condition}
          fieldChoices={fieldChoices}
          onChange={(condition) => patch({ condition })}
          label="Show only when…"
          // A standalone page has no form to read names from, so the field has
          // to be typeable or the editor would be unusable outside a workflow.
          allowCustomField={fieldChoices.length === 0}
          hint="Read from whatever the run has collected by the time this page shows."
        />
      ),
    },
  ];

  if (selected.type === 'table') {
    items.splice(1, 0, {
      key: 'table',
      label: 'Table',
      children: <EmbeddedTableEditor block={selected} onPatch={patch} />,
    });
  }

  return (
    <div className="fg-scroll" style={{ height: '100%' }}>
      <div className="fg-wf-inspector__head">
        <Typography.Text strong style={{ fontSize: 13 }}>
          {meta.label}
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>{selected.type}</Tag>
      </div>
      <Collapse ghost defaultActiveKey={['general']} items={items} size="small" />
    </div>
  );
}
