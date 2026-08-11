import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Row,
  Space,
  Spin,
  Typography,
} from 'antd';
import type { ScreenNode, ScreenSchema } from '@/schema/screen';
import { collectsValue, isTransparentContainer } from '@/schema/screen';
import type { NamePath } from './condition';
import { evaluateCondition } from './condition';
import {
  cardSize,
  cardVariant,
  dividerProps,
  getValueFromEventFor,
  renderControl,
  titleProps,
  valuePropNameFor,
} from './controls';
import { customDefFor, useCustomComponents } from './custom';
import { ListRenderer } from './ListRenderer';
import { RemoteStatus } from './remote/RemoteStatus';
import { useRemoteOptions } from './remote/useRemoteOptions';
import { ResolvedText, useStaticText } from './ResolvedText';
import { compileRules } from './rules';
import { useScreenContext } from './screenContext';
import { SummaryRenderer } from './summary/SummaryRenderer';
import { TableRenderer } from './table/TableRenderer';
import { useFieldVisibility } from './useFieldVisibility';

/**
 * One node of a screen, whatever kind it turns out to be.
 *
 * Replaces `FieldRenderer` and `PageBlockView`, which dispatched on `type` the
 * same way over two disjoint sets. `collectsValue` is the fork: a control gets a
 * `Form.Item`, a display node does not.
 *
 * Live and static are separate components rather than a branch, because the
 * live path calls `Form.useWatch` and the static path must not — outside a
 * `<Form>` it warns and returns nothing. A node's kind never changes under
 * React, so the element type never flips.
 */

export interface ScreenNodeViewProps {
  node: ScreenNode;
  /** `[]` at root, `[listName, rowIndex]` inside a repeatable row. */
  scopePath: NamePath;
  /** Prefix for `Form.Item` names — `[]` at root, `[rowIndex]` inside a row. */
  namePrefix: NamePath;
  gutter: number;
  /** The pressed button's id. A screen with no `actions` node never calls it. */
  onAction?: (actionId: string) => void;
  /** Earlier screens by id, so a `summary` node can lay a payload out. */
  formSources?: Record<string, ScreenSchema>;
}

const NO_SOURCES: Record<string, ScreenSchema> = {};

function headingLevel(node: ScreenNode): 1 | 2 | 3 | 4 | 5 {
  const raw = node.props?.level;
  const level = typeof raw === 'number' ? raw : 3;
  return (level >= 1 && level <= 5 ? level : 3) as 1 | 2 | 3 | 4 | 5;
}

function alertTone(node: ScreenNode): 'info' | 'success' | 'warning' | 'error' {
  const tone = node.props?.tone;
  return tone === 'success' || tone === 'warning' || tone === 'error' ? tone : 'info';
}

function num(node: ScreenNode, key: string, fallback: number): number {
  const raw = node.props?.[key];
  return typeof raw === 'number' ? raw : fallback;
}

function bool(node: ScreenNode, key: string, fallback: boolean): boolean {
  const raw = node.props?.[key];
  return typeof raw === 'boolean' ? raw : fallback;
}

/* -------------------------------------------------------------------------- */
/* Display nodes                                                               */
/* -------------------------------------------------------------------------- */

interface DisplayBodyProps {
  node: ScreenNode;
  onAction?: (actionId: string) => void;
  formSources: Record<string, ScreenSchema>;
}

/**
 * The body of a node that shows something. No hooks that need a `<Form>`, so
 * this renders identically inside a live screen and a static one.
 *
 * Exported because the builder canvas needs exactly this and *not* the
 * visibility gate around it: a node hidden by its own condition is still a node
 * you have to be able to click on to edit. A run applies the condition; the
 * canvas draws everything.
 */
export function DisplayNodeBody({ node, onAction, formSources }: DisplayBodyProps) {
  const { values } = useScreenContext();
  const src = useStaticText(node.src);

  switch (node.type) {
    case 'heading':
      return (
        <Typography.Title level={headingLevel(node)} style={{ marginTop: 0 }}>
          <ResolvedText template={node.text} />
        </Typography.Title>
      );

    case 'text':
      return (
        // Authored line breaks are content, the same reasoning the summary's
        // `textarea` formatting uses.
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
          <ResolvedText template={node.text} />
        </Typography.Paragraph>
      );

    case 'alert':
      return (
        // `title`, not `message`: antd 6 deprecates the latter on Alert.
        <Alert type={alertTone(node)} showIcon title={<ResolvedText template={node.text} />} />
      );

    case 'image': {
      if (src === '') return null;
      return (
        <img
          src={src}
          alt={node.alt}
          style={{
            display: 'block',
            maxWidth: '100%',
            borderRadius: bool(node, 'rounded', true) ? 8 : 0,
          }}
        />
      );
    }

    // A divider keeps the form's inline-label behaviour; a migrated page
    // divider simply arrives with a blank one.
    case 'divider':
      return <Divider {...dividerProps(node.props, Boolean(node.label))}>{node.label}</Divider>;

    case 'spacer':
      return <div style={{ height: num(node, 'height', 24) }} />;

    case 'dataList': {
      const items = (node.items ?? []).filter((item) => item.label !== '' || item.value !== '');
      if (items.length === 0) return null;
      return (
        <Descriptions
          size="small"
          column={num(node, 'columns', 1)}
          bordered={bool(node, 'bordered', true)}
          items={items.map((item, index) => ({
            key: index,
            label: item.label,
            children: <ResolvedText template={item.value} fallback="—" />,
          }))}
        />
      );
    }

    case 'summary': {
      const source = node.summarySource ? formSources[node.summarySource] : undefined;
      if (!source) return null;
      return (
        <SummaryRenderer
          schema={source}
          values={values}
          columns={num(node, 'columns', 2)}
          bordered={bool(node, 'bordered', true)}
        />
      );
    }

    case 'table':
      if (!node.table) return null;
      return <TableRenderer schema={node.table} />;

    case 'actions': {
      const actions = node.actions ?? [];
      if (actions.length === 0) return null;
      const align = node.props?.align;
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
              // A screen rendered without a handler — the builder canvas — still
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

/** Inside a `<Form>`: the condition watches live values. */
function LiveDisplayNode(props: DisplayBodyProps & { scopePath: NamePath }) {
  const visible = useFieldVisibility(props.node.condition, props.scopePath);
  if (!visible) return null;
  return <DisplayNodeBody {...props} />;
}

/** No surrounding `<Form>`: the condition reads the finished payload. */
function StaticDisplayNode(props: DisplayBodyProps & { scopePath: NamePath }) {
  const { values } = useScreenContext();
  if (!evaluateCondition(props.node.condition, values, props.scopePath)) return null;
  return <DisplayNodeBody {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A node that owns a payload key. Always inside a `<Form>` — `ScreenRenderer`
 * emits one exactly when the screen has a node like this.
 */
function ControlNode({ node, scopePath, namePrefix, gutter }: ScreenNodeViewProps) {
  // Subscribes to this node's own visibility only, so a keystroke elsewhere
  // does not re-render it. Must run before any early return.
  const visible = useFieldVisibility(node.condition, scopePath);
  // Hooks cannot be conditional, so this runs for every type. It is inert
  // unless the node carries a `dataSource`, and `visible` keeps a conditionally
  // hidden node from firing a request it would never show.
  const remote = useRemoteOptions(node, scopePath, visible);
  const customComponents = useCustomComponents();

  // A failed condition unmounts the node entirely; combined with
  // `preserve={false}` below, its value also leaves the submitted payload.
  if (!visible) return null;

  if (node.type === 'list') {
    return <ListRenderer node={node} gutter={gutter} />;
  }

  const control = renderControl(
    node,
    remote.active
      ? {
          options: remote.options,
          loading: remote.loading,
          onSearch: remote.onSearch,
          // A dependency is still blank — there is nothing to choose from yet.
          disabled: remote.missingDeps.length > 0,
          notFoundContent: remote.loading ? <Spin size="small" /> : undefined,
        }
      : undefined,
    customComponents,
  );
  if (!control) return null;

  return (
    <Form.Item
      name={[...namePrefix, node.name]}
      label={node.label}
      tooltip={node.tooltip}
      extra={remote.active ? <RemoteStatus node={node} state={remote} /> : node.extra}
      rules={compileRules(node.rules, node.type, customDefFor(node, customComponents)?.valueKind)}
      valuePropName={valuePropNameFor(node, customComponents)}
      getValueFromEvent={getValueFromEventFor(node)}
      hidden={node.hidden}
      // Drop the value when the node unmounts, so conditionally hidden
      // controls do not leak stale data into the submitted payload.
      preserve={false}
    >
      {control}
    </Form.Item>
  );
}

/* -------------------------------------------------------------------------- */
/* Containers                                                                  */
/* -------------------------------------------------------------------------- */

function ContainerNode(props: ScreenNodeViewProps) {
  const { node, scopePath, namePrefix, gutter } = props;
  const visible = useFieldVisibility(node.condition, scopePath);
  if (!visible) return null;

  // `scopePath` and `namePrefix` pass straight through: these containers are
  // chrome, so their children keep whatever scope the container itself sits
  // in. That is what keeps their names at the top level of the payload.
  const children = (
    <Row gutter={gutter}>
      {(node.children ?? []).map((child) => (
        <ScreenNodeView
          key={child.id}
          node={child}
          scopePath={scopePath}
          namePrefix={namePrefix}
          gutter={gutter}
          onAction={props.onAction}
          formSources={props.formSources}
        />
      ))}
    </Row>
  );

  if (node.type === 'card') {
    return (
      <Card
        title={node.label || undefined}
        extra={node.extra || undefined}
        size={cardSize(node.props)}
        // antd 6 deprecates `bordered` in favour of `variant`.
        variant={cardVariant(node.props)}
        style={{ marginBottom: 16 }}
      >
        {children}
      </Card>
    );
  }

  return (
    <fieldset
      style={{
        border: '1px solid rgba(5, 5, 5, 0.1)',
        borderRadius: 8,
        padding: '12px 16px 0',
        margin: '0 0 16px',
      }}
    >
      {node.label ? (
        <legend style={{ fontSize: 13, padding: '0 6px', width: 'auto', marginBottom: 0 }}>
          {node.label}
        </legend>
      ) : null}
      {children}
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The node body with no grid column around it.
 *
 * Exported because the builder canvas needs exactly this inside its own drag
 * and select wrapper, so what the canvas shows and what a run shows cannot
 * drift.
 */
export function ScreenNodeBody({
  node,
  scopePath,
  namePrefix,
  gutter,
  onAction,
  formSources = NO_SOURCES,
}: ScreenNodeViewProps) {
  const { live } = useScreenContext();

  if (isTransparentContainer(node.type)) {
    return (
      <ContainerNode
        node={node}
        scopePath={scopePath}
        namePrefix={namePrefix}
        gutter={gutter}
        onAction={onAction}
        formSources={formSources}
      />
    );
  }

  if (collectsValue(node.type)) {
    return (
      <ControlNode node={node} scopePath={scopePath} namePrefix={namePrefix} gutter={gutter} />
    );
  }

  const display = { node, onAction, formSources, scopePath };
  return live ? <LiveDisplayNode {...display} /> : <StaticDisplayNode {...display} />;
}

/** One node, in its grid column. */
export function ScreenNodeView(props: ScreenNodeViewProps) {
  const { node } = props;

  // A hidden control still mounts so its value reaches the payload; everything
  // else is simply not drawn.
  if (node.hidden && !collectsValue(node.type)) return null;

  // `span` is breakpoint-agnostic in antd, so an authored half-width node would
  // stay half-width on a phone. Below `sm`, everything goes full width.
  return (
    <Col
      xs={node.hidden ? 0 : 24}
      sm={node.hidden ? 0 : node.span}
      key={node.id}
    >
      <ScreenNodeBody {...props} />
    </Col>
  );
}

/** Kept for `titleProps`, which the canvas still uses for its heading preview. */
export { titleProps };
