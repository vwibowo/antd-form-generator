import { CopyOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Col, Empty, Form, Row, Tabs, Tag, Tooltip, Typography } from 'antd';
import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';
import {
  cardCollapsible,
  cardDefaultOpenKeys,
  cardSize,
  cardVariant,
  renderControl,
} from '@antd-form-generator/core/renderer/controls';
import { useCustomComponents } from '@antd-form-generator/core/renderer/custom';
import { compileRules } from '@antd-form-generator/core/renderer/rules';
import { ScreenContextProvider } from '@antd-form-generator/core/renderer/screenContext';
import { DisplayNodeBody } from '@antd-form-generator/core/renderer/ScreenNodeView';
import { metaFor } from '@antd-form-generator/core/schema/registry';
import type { ScreenNode, ScreenSchema } from '@antd-form-generator/core/schema/screen';
import { isDisplayType } from '@antd-form-generator/core/schema/screen';
import { ROOT_CONTAINER_ID } from '@antd-form-generator/core/schema/walk';
import { useBuilderStore } from '@/store/ScreenStoreContext';
import { type ContainerDropData, type FieldDragData, containerDroppableId } from './dndTypes';

/**
 * A payload that answers every key with its own token.
 *
 * At authoring time nothing has been collected, so resolving `{{fullName}}`
 * against an empty payload leaves a gap — and a gap is exactly what you cannot
 * edit, because it does not say which field it was. Echoing the token back
 * keeps the canvas showing the binding.
 */
const ECHO_TOKENS = new Proxy({} as Record<string, unknown>, {
  get: (_target, key) => (typeof key === 'string' ? `{{${key}}}` : undefined),
  has: () => true,
});

/**
 * Earlier screen steps a `summary` node can lay out, when the screen being
 * edited sits inside a workflow.
 *
 * A context rather than a prop because it would otherwise have to be threaded
 * through `FieldList` and `SortableField`, neither of which has any other
 * reason to know about it.
 */
const CanvasSourcesContext = createContext<Record<string, ScreenSchema>>({});

/* -------------------------------------------------------------------------- */
/* Static node preview                                                         */
/* -------------------------------------------------------------------------- */

/**
 * What a node with nothing in it yet should say, so it still occupies space and
 * can be clicked. `DisplayNodeBody` renders nothing for most of these, and a
 * node you cannot see is a node you cannot select.
 */
function emptyDisplayHint(node: ScreenNode): string | null {
  switch (node.type) {
    case 'heading':
    case 'text':
    case 'alert':
      return node.text.trim() === '' ? `Empty ${metaFor(node.type).label.toLowerCase()}` : null;
    case 'image':
      return node.src.trim() === '' ? 'No image URL yet' : null;
    case 'dataList':
      return (node.items ?? []).length === 0 ? 'No rows yet' : null;
    case 'actions':
      return (node.actions ?? []).length === 0 ? 'No buttons yet' : null;
    case 'summary':
      return node.summarySource ? null : 'Pick which step this summarises';
    case 'table':
      return (node.table?.columns.length ?? 0) === 0 ? 'No columns yet' : null;
    // `divider` and `spacer` draw themselves whatever their settings.
    default:
      return null;
  }
}

/**
 * The canvas shows a real antd control so the builder is WYSIWYG, but the
 * `Form.Item` is deliberately nameless — it renders label/required styling
 * without binding to any form store.
 *
 * A display node goes through the very same `DisplayNodeBody` a run uses, so
 * what the canvas shows and what a run shows cannot drift. Two deliberate
 * differences: `{{tokens}}` echo themselves rather than resolving, and the
 * node's `condition` is *not* applied — a step hidden by its own condition
 * still has to be selectable here.
 */
function NodePreview({ node }: { node: ScreenNode }) {
  // Custom components render for real on the canvas — the registry is app code,
  // so there is nothing to defer to runtime the way remote options are.
  const customComponents = useCustomComponents();
  const formSources = useContext(CanvasSourcesContext);

  if (isDisplayType(node.type)) {
    const hint = emptyDisplayHint(node);
    return (
      <ScreenContextProvider live={false} values={ECHO_TOKENS}>
        {hint ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Typography.Text>
        ) : (
          <DisplayNodeBody node={node} formSources={formSources} />
        )}
      </ScreenContextProvider>
    );
  }

  // Remote options are resolved by a hook in the renderer, and there is no hook
  // here — by design. The canvas must never issue a request while the user is
  // dragging fields around, so it shows an inert placeholder instead.
  const control = renderControl(
    node,
    node.dataSource
      ? { disabled: true, options: [], notFoundContent: 'Loads at runtime' }
      : undefined,
    customComponents,
  );
  if (!control) return null;

  return (
    <Form.Item
      label={node.label}
      tooltip={node.tooltip}
      extra={
        node.dataSource ? (
          <>
            {node.extra}
            {node.extra ? <br /> : null}
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Remote · {node.dataSource.url || 'no URL set'}
            </Typography.Text>
          </>
        ) : (
          node.extra
        )
      }
      rules={compileRules(node.rules, node.type)}
      required={node.rules.some((rule) => rule.kind === 'required')}
      style={{ marginBottom: 0 }}
    >
      {/* Previews are for looking at, not filling in. */}
      <div style={{ pointerEvents: 'none' }}>{control}</div>
    </Form.Item>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab strip                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A tab strip on the canvas.
 *
 * The panes are the tab cards' own drop targets, but the cards themselves are
 * not `SortableField`s — nesting one inside a pane would draw a card inside a
 * card. So the tab bar carries the affordances instead: clicking a tab selects
 * that card so the inspector can rename it, and antd's editable bar adds and
 * removes tabs in place.
 */
function TabsCanvas({ node }: { node: ScreenNode }) {
  const selectedId = useBuilderStore((state) => state.selectedId);
  const select = useBuilderStore((state) => state.select);
  const addNode = useBuilderStore((state) => state.addNode);
  const removeNode = useBuilderStore((state) => state.removeNode);

  const tabs = node.children ?? [];
  // Follow the selection when a tab is picked, so the open pane and the
  // inspector never disagree about which tab is being edited.
  const activeKey = tabs.some((tab) => tab.id === selectedId)
    ? selectedId ?? undefined
    : undefined;

  return (
    <Tabs
      size="small"
      type="editable-card"
      tabPlacement={node.props?.position === 'start' ? 'start' : 'top'}
      activeKey={activeKey}
      onTabClick={(key) => select(key)}
      onEdit={(targetKey, action) => {
        if (action === 'add') {
          addNode('card', node.id);
          return;
        }
        // A tab strip with no tabs renders nothing and cannot be dropped into,
        // so the last one stays.
        if (tabs.length > 1) removeNode(String(targetKey));
      }}
      items={tabs.map((tab) => ({
        key: tab.id,
        label: tab.label || 'Tab',
        closable: tabs.length > 1,
        children: (
          <FieldList
            containerId={tab.id}
            fields={tab.children ?? []}
            emptyLabel={`Drop fields into "${tab.label || 'this tab'}"`}
          />
        ),
      }))}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Drop zone                                                                   */
/* -------------------------------------------------------------------------- */

function DropZone({ containerId, label }: { containerId: string; label: string }) {
  const data: ContainerDropData = { source: 'container', containerId };
  const { setNodeRef, isOver } = useDroppable({ id: containerDroppableId(containerId), data });

  return (
    <div ref={setNodeRef} className={`fg-dropzone${isOver ? ' fg-dropzone--over' : ''}`}>
      {label}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sortable field card                                                         */
/* -------------------------------------------------------------------------- */

/** Badge shown on a container card so its kind is readable at a glance. */
const CONTAINER_TAG: Partial<Record<ScreenNode['type'], { color: string; text: string }>> = {
  group: { color: 'blue', text: 'group' },
  card: { color: 'cyan', text: 'card' },
  list: { color: 'purple', text: 'repeatable' },
  tabs: { color: 'geekblue', text: 'tabs' },
};

interface SortableFieldProps {
  node: ScreenNode;
  containerId: string;
  index: number;
}

function SortableField({ node, containerId, index }: SortableFieldProps) {
  const selectedId = useBuilderStore((state) => state.selectedId);
  const select = useBuilderStore((state) => state.select);
  const removeNode = useBuilderStore((state) => state.removeNode);
  const duplicateNode = useBuilderStore((state) => state.duplicateNode);

  const data: FieldDragData = {
    source: 'field',
    id: node.id,
    containerId,
    index,
    fieldType: node.type,
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSelected = selectedId === node.id;
  const meta = metaFor(node.type);
  const isContainer = meta.supports.children;

  return (
    <Col span={node.span}>
      <div
        ref={setNodeRef}
        style={style}
        className={[
          'fg-node',
          isSelected ? 'fg-node--selected' : '',
          isDragging ? 'fg-node--dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={(event) => {
          event.stopPropagation();
          select(node.id);
        }}
      >
        <div className="fg-node__actions" onClick={(event) => event.stopPropagation()}>
          <Tooltip title="Drag to reorder">
            <Button
              type="text"
              size="small"
              className="fg-node__handle"
              icon={<HolderOutlined />}
              aria-label={`Drag ${node.label || node.name}`}
              {...listeners}
              {...attributes}
            />
          </Tooltip>
          <Tooltip title="Duplicate">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              aria-label="Duplicate field"
              onClick={() => duplicateNode(node.id)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="Delete field"
              onClick={() => removeNode(node.id)}
            />
          </Tooltip>
        </div>

        {isContainer ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Typography.Text strong>{node.label || meta.label}</Typography.Text>
              <Tag color={CONTAINER_TAG[node.type]?.color}>
                {node.type === 'list' ? `repeatable · ${node.name}` : CONTAINER_TAG[node.type]?.text}
              </Tag>
            </div>
            {node.type === 'tabs' ? (
              // Each tab is a card, so each pane is that card's own drop target.
              // Only the open tab accepts a drop — switching tabs is how you
              // reach the others, the same trade the preview makes.
              //
              // Clicking a tab selects that card, which is the only way to reach
              // its settings: a tab is not rendered as its own `SortableField`,
              // so without this it had no drag handle, no delete button and no
              // route to the inspector — and its label could not be changed.
              <TabsCanvas node={node} />
            ) : node.type === 'card' ? (
              // Render the real Card so the canvas matches the preview. A
              // collapsible one is drawn open whatever `defaultOpen` says: a
              // folded section hides its drop zone, and the canvas has to stay
              // editable — the same reason a conditional node is not gated here.
              <Card
                size={cardSize(node.props)}
                variant={cardVariant(node.props)}
                title={
                  cardCollapsible(node.props) ? (
                    <Tag color="gold">
                      collapsible{cardDefaultOpenKeys(node.props).length === 0 ? ' · starts shut' : ''}
                    </Tag>
                  ) : undefined
                }
              >
                <FieldList
                  containerId={node.id}
                  fields={node.children ?? []}
                  emptyLabel={`Drop fields into "${node.label || meta.label}"`}
                />
              </Card>
            ) : (
              <FieldList
                containerId={node.id}
                fields={node.children ?? []}
                emptyLabel={`Drop fields into "${node.label || meta.label}"`}
              />
            )}
          </div>
        ) : (
          <NodePreview node={node} />
        )}
      </div>
    </Col>
  );
}

/* -------------------------------------------------------------------------- */
/* Sortable list of fields for one container                                   */
/* -------------------------------------------------------------------------- */

interface FieldListProps {
  containerId: string;
  fields: ScreenNode[];
  emptyLabel: string;
}

/**
 * One sortable context per container. The trailing drop zone is what lets an
 * empty container — and the space past the last field — accept a drop.
 */
export function FieldList({ containerId, fields, emptyLabel }: FieldListProps) {
  const gutter = useBuilderStore((state) => state.schema.gutter);

  return (
    <SortableContext items={fields.map((node) => node.id)} strategy={verticalListSortingStrategy}>
      {fields.length > 0 ? (
        <Row gutter={gutter} style={{ marginBottom: 8 }}>
          {fields.map((node, index) => (
            <SortableField key={node.id} node={node} containerId={containerId} index={index} />
          ))}
        </Row>
      ) : null}
      <DropZone containerId={containerId} label={emptyLabel} />
    </SortableContext>
  );
}

/* -------------------------------------------------------------------------- */
/* Root canvas                                                                 */
/* -------------------------------------------------------------------------- */

export interface CanvasProps {
  /** Earlier screen steps a `summary` node can lay out, inside a workflow. */
  formSources?: Record<string, ScreenSchema>;
}

export function Canvas({ formSources = {} }: CanvasProps = {}) {
  const schema = useBuilderStore((state) => state.schema);
  const select = useBuilderStore((state) => state.select);

  return (
    <div
      className="fg-scroll"
      style={{ height: '100%', padding: 16 }}
      onClick={() => select(null)}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 16,
          minHeight: '100%',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        {schema.title ? (
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            {schema.title}
          </Typography.Title>
        ) : null}

        {/* A real Form supplies layout/size context to the nameless previews. */}
        <CanvasSourcesContext.Provider value={formSources}>
        <Form
          layout={schema.layout}
          size={schema.size}
          colon={schema.colon}
          labelCol={schema.layout === 'horizontal' ? schema.labelCol : undefined}
          wrapperCol={schema.layout === 'horizontal' ? schema.wrapperCol : undefined}
          component={false}
        >
          <FieldList
            containerId={ROOT_CONTAINER_ID}
            fields={schema.nodes}
            emptyLabel="Drag a node here, or click one in the palette"
          />
        </Form>
        </CanvasSourcesContext.Provider>

        {schema.nodes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="This screen is empty"
            style={{ marginTop: 32 }}
          />
        ) : null}
      </div>
    </div>
  );
}
