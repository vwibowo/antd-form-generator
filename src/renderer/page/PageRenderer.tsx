import { Alert, Button, Col, Descriptions, Divider, Empty, Row, Space, Typography } from 'antd';
import type { PageBlock, PageSchema } from '@/schema/page';
import type { FormSchema } from '@/schema/schema';
import { evaluateCondition } from '../condition';
import type { CustomComponentRegistry } from '../custom';
import { CustomComponentsProvider, useCustomComponents } from '../custom';
import { SummaryRenderer } from '../summary/SummaryRenderer';
import { TableRenderer } from '../table/TableRenderer';
import { resolveTextTemplate } from './template';

/**
 * Renders a `PageSchema` as a screen.
 *
 * The counterpart to `FormRenderer`: a form asks, a page tells and offers a way
 * onward. Most block types are delegation rather than new rendering —
 * `SummaryRenderer` already turns a payload into a read-only page and
 * `TableRenderer` already draws a table document, so a page composes them.
 *
 * This module and everything it imports are free of builder imports, so
 * `src/renderer/` stays liftable into a standalone package.
 */
export interface PageRendererProps {
  schema: PageSchema;
  /**
   * The payload this page is showing: `{{token}}` text, data list rows and
   * block conditions all read from it. Absent in the builder canvas, where
   * there is nothing collected yet.
   */
  values?: Record<string, unknown>;
  /** The pressed button's id. A page with no `actions` block never calls it. */
  onAction?: (actionId: string) => void;
  /**
   * Form schemas by id, so a `summary` block can lay a payload out. A payload
   * has no layout of its own, which is why the source has to be handed in.
   */
  formSources?: Record<string, FormSchema>;
  components?: CustomComponentRegistry;
}

const NO_VALUES: Record<string, unknown> = {};

function headingLevel(block: PageBlock): 1 | 2 | 3 | 4 | 5 {
  const raw = block.props?.level;
  const level = typeof raw === 'number' ? raw : 3;
  return (level >= 1 && level <= 5 ? level : 3) as 1 | 2 | 3 | 4 | 5;
}

function alertTone(block: PageBlock): 'info' | 'success' | 'warning' | 'error' {
  const tone = block.props?.tone;
  return tone === 'success' || tone === 'warning' || tone === 'error' ? tone : 'info';
}

function num(block: PageBlock, key: string, fallback: number): number {
  const raw = block.props?.[key];
  return typeof raw === 'number' ? raw : fallback;
}

function bool(block: PageBlock, key: string, fallback: boolean): boolean {
  const raw = block.props?.[key];
  return typeof raw === 'boolean' ? raw : fallback;
}

export interface PageBlockViewProps {
  block: PageBlock;
  values?: Record<string, unknown>;
  onAction?: (actionId: string) => void;
  formSources?: Record<string, FormSchema>;
}

/**
 * One block, with no selection chrome and no grid column around it.
 *
 * Exported because the builder canvas needs exactly this inside its own drag
 * and select wrapper — the same split `Canvas.tsx` makes with `FieldPreview`,
 * so what the canvas shows and what a run shows cannot drift.
 */
export function PageBlockView({
  block,
  values = NO_VALUES,
  onAction,
  formSources = {},
}: PageBlockViewProps) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography.Title level={headingLevel(block)} style={{ marginTop: 0 }}>
          {resolveTextTemplate(block.text, values)}
        </Typography.Title>
      );

    case 'text':
      return (
        // Authored line breaks are content, the same reasoning the summary's
        // `textarea` formatting uses.
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
          {resolveTextTemplate(block.text, values)}
        </Typography.Paragraph>
      );

    case 'alert':
      return (
        <Alert
          type={alertTone(block)}
          showIcon
          // `title`, not `message`: antd 6 deprecates the latter on Alert.
          title={resolveTextTemplate(block.text, values)}
        />
      );

    case 'image': {
      const src = resolveTextTemplate(block.src, values);
      if (src === '') return null;
      return (
        <img
          src={src}
          alt={block.alt}
          style={{
            display: 'block',
            maxWidth: '100%',
            borderRadius: bool(block, 'rounded', true) ? 8 : 0,
          }}
        />
      );
    }

    case 'divider':
      return <Divider style={{ margin: 0 }} />;

    case 'spacer':
      return <div style={{ height: num(block, 'height', 24) }} />;

    case 'dataList': {
      const items = (block.items ?? []).filter((item) => item.label !== '' || item.value !== '');
      if (items.length === 0) return null;
      return (
        <Descriptions
          size="small"
          column={num(block, 'columns', 1)}
          bordered={bool(block, 'bordered', true)}
          items={items.map((item, index) => ({
            key: index,
            label: item.label,
            // Blank rather than the raw token: see `resolveTextTemplate`.
            children: resolveTextTemplate(item.value, values) || '—',
          }))}
        />
      );
    }

    case 'summary': {
      const source = block.summarySource ? formSources[block.summarySource] : undefined;
      if (!source) return null;
      return (
        <SummaryRenderer
          schema={source}
          values={values}
          columns={num(block, 'columns', 2)}
          bordered={bool(block, 'bordered', true)}
        />
      );
    }

    case 'table':
      if (!block.table) return null;
      return <TableRenderer schema={block.table} />;

    case 'actions': {
      const actions = block.actions ?? [];
      if (actions.length === 0) return null;
      const align = block.props?.align;
      return (
        <Space
          wrap
          style={{
            display: 'flex',
            justifyContent:
              align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          {actions.map((action) => (
            <Button
              key={action.id}
              type={action.variant}
              danger={action.danger}
              // A page rendered without a handler — the builder canvas — still
              // shows its buttons; they just do nothing.
              onClick={onAction ? () => onAction(action.id) : undefined}
            >
              {action.label || action.id}
            </Button>
          ))}
        </Space>
      );
    }

    default:
      return null;
  }
}

export function PageRenderer({
  schema,
  values,
  onAction,
  formSources = {},
  components,
}: PageRendererProps) {
  const inherited = useCustomComponents();
  const registry = components ?? inherited;
  const payload = values ?? NO_VALUES;

  if (schema.blocks.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="This page has no blocks yet"
        style={{ padding: '48px 0' }}
      />
    );
  }

  return (
    // Re-provided so a `summary` block's custom fields resolve even when the
    // host did not wrap this subtree itself — same reason `FormRenderer` does.
    <CustomComponentsProvider components={registry}>
      <div className="fg-page" style={{ maxWidth: schema.maxWidth, margin: '0 auto' }}>
        {schema.title ? (
          <Typography.Title level={2} style={{ marginTop: 0 }}>
            {resolveTextTemplate(schema.title, payload)}
          </Typography.Title>
        ) : null}
        {schema.description ? (
          <Typography.Paragraph type="secondary">
            {resolveTextTemplate(schema.description, payload)}
          </Typography.Paragraph>
        ) : null}

        <Row gutter={[schema.gutter, schema.gutter]}>
          {schema.blocks.map((block) => {
            if (block.hidden) return null;
            // A failed condition removes the block outright, matching how a
            // field's condition unmounts it rather than hiding it.
            if (!evaluateCondition(block.condition, payload)) return null;

            return (
              <Col key={block.id} span={block.span}>
                <PageBlockView
                  block={block}
                  values={payload}
                  onAction={onAction}
                  formSources={formSources}
                />
              </Col>
            );
          })}
        </Row>
      </div>
    </CustomComponentsProvider>
  );
}
