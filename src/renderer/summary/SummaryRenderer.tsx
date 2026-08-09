import { Card, Descriptions, Divider, Empty, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { ReactNode } from 'react';
import type { FieldNode, FormSchema } from '@/schema/schema';
import { isPresentationalType, isTransparentContainer } from '@/schema/schema';
import type { NamePath } from '../condition';
import { evaluateCondition } from '../condition';
import { dividerProps, titleProps } from '../controls';
import type { CustomComponentRegistry } from '../custom';
import { useCustomComponents } from '../custom';
import { formatFieldValue } from './format';

type DescriptionItem = NonNullable<DescriptionsProps['items']>[number];

export interface SummaryRendererProps {
  schema: FormSchema;
  /** A submitted payload, in the shape `FormRenderer`'s `onSubmit` hands over. */
  values: Record<string, unknown>;
  /** Description columns from `md` up. Always one column below that. */
  columns?: number;
  bordered?: boolean;
  /**
   * Host-supplied controls, consulted for `custom` fields' `summary` hook.
   * Omit to inherit whatever a surrounding `CustomComponentsProvider` supplies.
   */
  components?: CustomComponentRegistry;
}

/**
 * Renders a submitted payload as a read-only page — the confirmation step
 * between filling a form in and sending it.
 *
 * There is no summary schema: the layout is derived from the `FormSchema` the
 * values came from. The traversal mirrors `serialize.ts` and `FieldRenderer`,
 * so what a reader sees here and what the payload carries cannot drift apart:
 * `group` and `card` are chrome whose children keep top-level names, a `list`
 * is an array of rows, and a field whose `condition` fails is absent from both.
 *
 * Like the rest of `src/renderer/`, this module is free of builder imports.
 */
export function SummaryRenderer({
  schema,
  values,
  columns = 2,
  bordered = false,
  components,
}: SummaryRendererProps) {
  const inherited = useCustomComponents();
  const context: Context = {
    values,
    columns,
    bordered,
    registry: components ?? inherited,
  };

  const blocks = renderNodes(schema.fields, [], context);

  return (
    <div className="fg-summary">
      {schema.title ? (
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {schema.title}
        </Typography.Title>
      ) : null}
      {schema.description ? (
        <Typography.Paragraph type="secondary">{schema.description}</Typography.Paragraph>
      ) : null}

      {blocks.length > 0 ? (
        blocks
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Nothing to summarise yet"
          style={{ padding: '32px 0' }}
        />
      )}
    </div>
  );
}

interface Context {
  values: Record<string, unknown>;
  columns: number;
  bordered: boolean;
  registry: CustomComponentRegistry;
}

/**
 * Read an absolute path out of the payload. Deliberately strict, unlike
 * `resolveConditionValue`: a row field that is simply absent must read as blank
 * rather than fall back to a top-level field that happens to share its name.
 */
function readValue(values: unknown, path: NamePath): unknown {
  let current: unknown = values;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

/**
 * Decide where each row ends before antd does.
 *
 * antd fills rows greedily and, when an item does not fit the space left, it
 * *clamps that item's span* rather than moving it down — so a full-width field
 * landing after an odd number of half-width ones silently renders half width
 * (and warns). Closing the previous row with `span: 'filled'` gives the wide
 * item a row of its own, which is what the form's own layout does.
 */
function packRows(
  entries: { item: DescriptionItem; width: number }[],
  columns: number,
): DescriptionItem[] {
  const items: DescriptionItem[] = [];
  let used = 0;

  for (const { item, width } of entries) {
    if (used > 0 && used + width > columns) {
      const previous = items.length - 1;
      items[previous] = { ...items[previous], span: 'filled' };
      used = 0;
    }
    items.push(item);
    used = (used + width) % columns;
  }

  return items;
}

/**
 * Turn a list of nodes into blocks, gathering runs of plain fields into one
 * `Descriptions` and flushing it whenever a section, list or heading breaks
 * the run.
 */
function renderNodes(nodes: FieldNode[], scopePath: NamePath, context: Context): ReactNode[] {
  const blocks: ReactNode[] = [];
  // Width travels beside each item: antd packs rows greedily and clamps an item
  // that does not fit the space left, so the packing has to be decided here.
  let pending: { item: DescriptionItem; width: number }[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    const items = packRows(pending, context.columns);
    pending = [];
    blocks.push(
      <Descriptions
        key={`fields-${String(items[0]?.key)}`}
        items={items}
        bordered={context.bordered}
        size="small"
        column={{ xs: 1, md: context.columns }}
        style={{ marginBottom: 16 }}
      />,
    );
  };

  for (const node of nodes) {
    // Hidden fields still submit, but they were never shown — a confirmation
    // page repeats what the user was asked, not what the payload carries.
    if (node.hidden) continue;
    // Same rule the renderer applies, evaluated against the payload rather
    // than a live form: a failed condition means the value is not there.
    if (!evaluateCondition(node.condition, context.values, scopePath)) continue;

    if (node.type === 'divider') {
      flush();
      blocks.push(
        <Divider key={node.id} {...dividerProps(node.props, Boolean(node.label))}>
          {node.label}
        </Divider>,
      );
      continue;
    }

    if (node.type === 'title') {
      flush();
      blocks.push(
        <div key={node.id} style={{ marginBottom: 8 }}>
          <Typography.Title {...titleProps(node.props)} style={{ marginBottom: 4 }}>
            {node.label}
          </Typography.Title>
          {node.extra ? <Typography.Text type="secondary">{node.extra}</Typography.Text> : null}
        </div>,
      );
      continue;
    }

    if (isTransparentContainer(node.type)) {
      flush();
      // `scopePath` passes straight through — these containers contribute no
      // key of their own, so their children read from the same level.
      const children = renderNodes(node.children ?? [], scopePath, context);
      if (children.length === 0) continue;

      blocks.push(
        node.type === 'card' ? (
          <Card
            key={node.id}
            title={node.label || undefined}
            extra={node.extra || undefined}
            size="small"
            style={{ marginBottom: 16 }}
          >
            {children}
          </Card>
        ) : (
          <section key={node.id} style={{ marginBottom: 16 }}>
            {node.label ? (
              <Typography.Title level={5} style={{ marginBottom: 8 }}>
                {node.label}
              </Typography.Title>
            ) : null}
            {children}
          </section>
        ),
      );
      continue;
    }

    if (node.type === 'list') {
      flush();
      blocks.push(renderList(node, scopePath, context));
      continue;
    }

    if (isPresentationalType(node.type)) continue;

    // A full-width field keeps its whole row; anything narrower shares one.
    const width = node.span >= 24 ? context.columns : 1;
    pending.push({
      width,
      item: {
        key: node.id,
        label: node.label || node.name,
        // Responsive, because the page drops to a single column below `md`.
        span: width > 1 ? { xs: 1, md: width } : 1,
        children: formatFieldValue(
          node,
          readValue(context.values, [...scopePath, node.name]),
          context.registry,
        ),
      },
    });
  }

  flush();
  return blocks;
}

/** One block per row, so a repeatable section reads as a numbered list. */
function renderList(node: FieldNode, scopePath: NamePath, context: Context): ReactNode {
  const rows = readValue(context.values, [...scopePath, node.name]);
  const label = node.label || node.name;

  const heading = (
    <Typography.Title level={5} style={{ marginBottom: 8 }}>
      {label}
    </Typography.Title>
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <section key={node.id} style={{ marginBottom: 16 }}>
        {heading}
        <Typography.Text type="secondary">No items</Typography.Text>
      </section>
    );
  }

  return (
    <section key={node.id} style={{ marginBottom: 16 }}>
      {heading}
      {rows.map((_row, index) => (
        <div
          // Rows have no identity of their own in the payload — position is it.
          key={`${node.id}-${index}`}
          className="fg-summary__row"
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {label} {index + 1}
          </Typography.Text>
          {renderNodes(node.children ?? [], [...scopePath, node.name, index], context)}
        </div>
      ))}
    </section>
  );
}
