import { CopyOutlined, DeleteOutlined, EyeInvisibleOutlined, HolderOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Col, Empty, Row, Tag, Tooltip, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { PageBlockView } from '@/renderer/page/PageRenderer';
import type { FormSchema } from '@/schema/schema';
import type { PageBlock } from '@/schema/page';
import { pageBlockMetaFor } from '@/schema/pageRegistry';
import { usePageBuilderStore } from '@/store/PageStoreContext';
import { type BlockDragData, PAGE_END_ID, type PageDropData } from './dndTypes';

/**
 * A payload that answers every key with its own token.
 *
 * At authoring time nothing has been collected, so resolving `{{fullName}}`
 * against an empty payload leaves a gap — and a gap is exactly what you cannot
 * edit, because it does not say which field it was. Echoing the token back
 * keeps the canvas showing the binding, the way the title field does.
 */
const ECHO_TOKENS = new Proxy({} as Record<string, unknown>, {
  get: (_target, key) => (typeof key === 'string' ? `{{${key}}}` : undefined),
  has: () => true,
});

export interface PageCanvasProps {
  /**
   * Form schemas a `summary` block can lay out. Supplied when the page is being
   * edited inside a workflow; empty for a standalone page, where such a block
   * shows a placeholder instead.
   */
  formSources?: Record<string, FormSchema>;
}

function SortableBlock({
  block,
  index,
  formSources,
}: {
  block: PageBlock;
  index: number;
  formSources: Record<string, FormSchema>;
}) {
  const selectedId = usePageBuilderStore((state) => state.selectedId);
  const select = usePageBuilderStore((state) => state.select);
  const removeBlock = usePageBuilderStore((state) => state.removeBlock);
  const duplicateBlock = usePageBuilderStore((state) => state.duplicateBlock);

  const data: BlockDragData = { source: 'page-block', id: block.id, index };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = pageBlockMetaFor(block.type);
  const selected = selectedId === block.id;
  const needsSource = block.type === 'summary' && !block.summarySource;

  return (
    <Col span={block.span} ref={setNodeRef} style={style}>
      <div
        className={`fg-node${selected ? ' fg-node--selected' : ''}${
          isDragging ? ' fg-node--dragging' : ''
        }`}
        onClick={(event) => {
          event.stopPropagation();
          select(block.id);
        }}
      >
        <div className="fg-node__actions">
          <Tooltip title="Drag to reorder">
            <Button
              size="small"
              type="text"
              icon={<HolderOutlined />}
              className="fg-node__handle"
              aria-label={`Drag ${meta.label}`}
              {...listeners}
              {...attributes}
            />
          </Tooltip>
          <Tooltip title="Duplicate">
            <Button
              size="small"
              type="text"
              icon={<CopyOutlined />}
              aria-label="Duplicate block"
              onClick={(event) => {
                event.stopPropagation();
                duplicateBlock(block.id);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Delete block"
              onClick={(event) => {
                event.stopPropagation();
                removeBlock(block.id);
              }}
            />
          </Tooltip>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {meta.label}
          </Typography.Text>
          {block.hidden ? (
            <Tag icon={<EyeInvisibleOutlined />} style={{ marginInlineEnd: 0 }}>
              hidden
            </Tag>
          ) : null}
          {block.condition ? (
            <Tag color="purple" style={{ marginInlineEnd: 0 }}>
              conditional
            </Tag>
          ) : null}
        </div>

        {/* The canvas shows the real block so the builder is WYSIWYG, with no
            payload — there is nothing collected at authoring time, so `{{field}}`
            renders blank here by design. */}
        {needsSource ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Pick which form step this summarises.
          </Typography.Text>
        ) : (
          <PageBlockView block={block} values={ECHO_TOKENS} formSources={formSources} />
        )}
      </div>
    </Col>
  );
}

/** Trailing drop zone — what lets a drop past the last block append. */
function EndZone() {
  const data: PageDropData = { source: 'page-end' };
  const { setNodeRef, isOver } = useDroppable({ id: PAGE_END_ID, data });

  return (
    <Col span={24} ref={setNodeRef}>
      <div
        style={{
          border: `1px dashed ${isOver ? '#1677ff' : 'rgba(5, 5, 5, 0.15)'}`,
          borderRadius: 8,
          padding: '14px 12px',
          textAlign: 'center',
          background: isOver ? 'rgba(22, 119, 255, 0.04)' : undefined,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Drag a block here, or click one in the palette
        </Typography.Text>
      </div>
    </Col>
  );
}

export function PageCanvas({ formSources = {} }: PageCanvasProps) {
  const schema = usePageBuilderStore((state) => state.schema);
  const select = usePageBuilderStore((state) => state.select);

  return (
    <div className="fg-scroll" style={{ height: '100%', padding: 16 }} onClick={() => select(null)}>
      <div
        style={{
          maxWidth: schema.maxWidth,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          minHeight: '100%',
        }}
      >
        {schema.title ? (
          <Typography.Title level={2} style={{ marginTop: 0 }}>
            {schema.title}
          </Typography.Title>
        ) : null}
        {schema.description ? (
          <Typography.Paragraph type="secondary">{schema.description}</Typography.Paragraph>
        ) : null}

        <SortableContext
          items={schema.blocks.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <Row gutter={[schema.gutter, schema.gutter]}>
            {schema.blocks.map((block, index) => (
              <SortableBlock
                key={block.id}
                block={block}
                index={index}
                formSources={formSources}
              />
            ))}
            <EndZone />
          </Row>
        </SortableContext>

        {schema.blocks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Your page is empty"
            style={{ padding: '32px 0' }}
          />
        ) : null}
      </div>
    </div>
  );
}
