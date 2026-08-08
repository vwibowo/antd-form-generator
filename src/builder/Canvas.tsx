import { CopyOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Col, Divider, Empty, Form, Row, Tag, Tooltip, Typography } from 'antd';
import type { CSSProperties } from 'react';
import {
  cardSize,
  cardVariant,
  dividerProps,
  renderControl,
  titleProps,
} from '@/renderer/controls';
import { useCustomComponents } from '@/renderer/custom';
import { compileRules } from '@/renderer/rules';
import { metaFor } from '@/schema/registry';
import type { FieldNode } from '@/schema/schema';
import { ROOT_CONTAINER_ID } from '@/schema/walk';
import { useSchemaStore } from '@/store/useSchemaStore';
import { type ContainerDropData, type FieldDragData, containerDroppableId } from './dndTypes';

/* -------------------------------------------------------------------------- */
/* Static field preview                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The canvas shows a real antd control so the builder is WYSIWYG, but the
 * `Form.Item` is deliberately nameless — it renders label/required styling
 * without binding to any form store.
 */
function FieldPreview({ node }: { node: FieldNode }) {
  // Custom components render for real on the canvas — the registry is app code,
  // so there is nothing to defer to runtime the way remote options are.
  const customComponents = useCustomComponents();

  if (node.type === 'divider') {
    return (
      <Divider {...dividerProps(node.props, Boolean(node.label))} style={{ margin: '8px 0' }}>
        {node.label}
      </Divider>
    );
  }

  if (node.type === 'title') {
    return (
      <Typography.Title {...titleProps(node.props)} style={{ margin: 0 }}>
        {node.label || 'Heading'}
      </Typography.Title>
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
const CONTAINER_TAG: Partial<Record<FieldNode['type'], { color: string; text: string }>> = {
  group: { color: 'blue', text: 'group' },
  card: { color: 'cyan', text: 'card' },
  list: { color: 'purple', text: 'repeatable' },
};

interface SortableFieldProps {
  node: FieldNode;
  containerId: string;
  index: number;
}

function SortableField({ node, containerId, index }: SortableFieldProps) {
  const selectedId = useSchemaStore((state) => state.selectedId);
  const select = useSchemaStore((state) => state.select);
  const removeField = useSchemaStore((state) => state.removeField);
  const duplicateNode = useSchemaStore((state) => state.duplicateNode);

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
              onClick={() => removeField(node.id)}
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
            {node.type === 'card' ? (
              // Render the real Card so the canvas matches the preview.
              <Card size={cardSize(node.props)} variant={cardVariant(node.props)}>
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
          <FieldPreview node={node} />
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
  fields: FieldNode[];
  emptyLabel: string;
}

/**
 * One sortable context per container. The trailing drop zone is what lets an
 * empty container — and the space past the last field — accept a drop.
 */
export function FieldList({ containerId, fields, emptyLabel }: FieldListProps) {
  const gutter = useSchemaStore((state) => state.schema.gutter);

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

export function Canvas() {
  const schema = useSchemaStore((state) => state.schema);
  const select = useSchemaStore((state) => state.select);

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
            fields={schema.fields}
            emptyLabel="Drag a field here, or click one in the palette"
          />
        </Form>

        {schema.fields.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Your form is empty"
            style={{ marginTop: 32 }}
          />
        ) : null}
      </div>
    </div>
  );
}
