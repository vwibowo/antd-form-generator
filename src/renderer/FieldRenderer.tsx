import { Card, Col, Divider, Form, Row, Spin, Typography } from 'antd';
import type { FieldNode } from '@/schema/schema';
import { isPresentationalType, isTransparentContainer } from '@/schema/schema';
import type { NamePath } from './condition';
import { customDefFor, useCustomComponents } from './custom';
import { useFieldVisibility } from './useFieldVisibility';
import {
  cardSize,
  cardVariant,
  dividerProps,
  getValueFromEventFor,
  renderControl,
  titleProps,
  valuePropNameFor,
} from './controls';
import { ListRenderer } from './ListRenderer';
import { RemoteStatus } from './remote/RemoteStatus';
import { useRemoteOptions } from './remote/useRemoteOptions';
import { compileRules } from './rules';

export interface FieldRendererProps {
  node: FieldNode;
  /** `[]` at root, `[listName, rowIndex]` inside a repeatable row. */
  scopePath: NamePath;
  /** Prefix for `Form.Item` names — `[]` at root, `[rowIndex]` inside a row. */
  namePrefix: NamePath;
  gutter: number;
}

export function FieldRenderer({ node, scopePath, namePrefix, gutter }: FieldRendererProps) {
  // Subscribes to this field's own visibility only, so a keystroke elsewhere
  // in the form does not re-render it. Must run before any early return.
  const visible = useFieldVisibility(node.condition, scopePath);
  // Hooks cannot be conditional, so this runs for every node type. It is inert
  // unless the node carries a `dataSource`, and `visible` keeps a conditionally
  // hidden field from firing a request it would never show.
  const remote = useRemoteOptions(node, scopePath, visible);
  const customComponents = useCustomComponents();

  // A failed condition unmounts the field entirely; combined with
  // `preserve={false}` below, its value also leaves the submitted payload.
  if (!visible) {
    return null;
  }

  if (node.type === 'divider') {
    return (
      <Col span={24} key={node.id}>
        <Divider {...dividerProps(node.props, Boolean(node.label))}>{node.label}</Divider>
      </Col>
    );
  }

  if (node.type === 'title') {
    return (
      <Col xs={24} sm={node.span} key={node.id}>
        <Typography.Title {...titleProps(node.props)} style={{ marginBottom: 8 }}>
          {node.label}
        </Typography.Title>
        {node.extra ? <Typography.Text type="secondary">{node.extra}</Typography.Text> : null}
      </Col>
    );
  }

  if (isTransparentContainer(node.type)) {
    // `scopePath` and `namePrefix` pass straight through: these containers are
    // chrome, so their children keep whatever scope the container itself sits
    // in. That is what keeps their names at the top level of the payload.
    const children = (
      <Row gutter={gutter}>
        {(node.children ?? []).map((child) => (
          <FieldRenderer
            key={child.id}
            node={child}
            scopePath={scopePath}
            namePrefix={namePrefix}
            gutter={gutter}
          />
        ))}
      </Row>
    );

    if (node.type === 'card') {
      return (
        <Col xs={24} sm={node.span} key={node.id}>
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
        </Col>
      );
    }

    return (
      <Col xs={24} sm={node.span} key={node.id}>
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
      </Col>
    );
  }

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

  const item = (
    <Form.Item
      name={[...namePrefix, node.name]}
      label={isPresentationalType(node.type) ? undefined : node.label}
      tooltip={node.tooltip}
      extra={remote.active ? <RemoteStatus node={node} state={remote} /> : node.extra}
      rules={compileRules(node.rules, node.type, customDefFor(node, customComponents)?.valueKind)}
      valuePropName={valuePropNameFor(node, customComponents)}
      getValueFromEvent={getValueFromEventFor(node)}
      hidden={node.hidden}
      // Drop the value when the field unmounts, so conditionally hidden
      // fields do not leak stale data into the submitted payload.
      preserve={false}
    >
      {control}
    </Form.Item>
  );

  // `span` is breakpoint-agnostic in antd, so an authored half-width field
  // would stay half-width on a phone. Below `sm`, everything goes full width.
  return (
    <Col xs={node.hidden ? 0 : 24} sm={node.hidden ? 0 : node.span} key={node.id}>
      {item}
    </Col>
  );
}
