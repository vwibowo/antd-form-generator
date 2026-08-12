import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Empty, Form, Row, Space, Typography } from 'antd';
import type { ScreenNode } from '../schema/screen';
import { ScreenNodeView } from './ScreenNodeView';
import { buildRowTemplate } from './initialValues';

export interface ListRendererProps {
  node: ScreenNode;
  gutter: number;
}

/** Repeatable section — an array of objects backed by `Form.List`. */
export function ListRenderer({ node, gutter }: ListRendererProps) {
  const children = node.children ?? [];
  const config = node.listConfig;
  const min = config?.minItems ?? 0;
  const max = config?.maxItems;

  return (
    <Col xs={24} sm={node.span}>
      <div style={{ marginBottom: 24 }}>
        {node.label ? (
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {node.label}
          </Typography.Text>
        ) : null}
        {node.extra ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {node.extra}
          </Typography.Text>
        ) : null}

        <Form.List name={node.name}>
          {(rows, { add, remove }) => (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {rows.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No items yet"
                  style={{ margin: '8px 0' }}
                />
              ) : null}

              {rows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    border: '1px solid rgba(5, 5, 5, 0.1)',
                    borderRadius: 8,
                    padding: '12px 16px 0',
                    position: 'relative',
                  }}
                >
                  <Row gutter={gutter}>
                    {children.map((child) => (
                      <ScreenNodeView
                        key={child.id}
                        node={child}
                        // Conditions inside a row resolve against that row
                        // first, then fall back to the top level.
                        scopePath={[node.name, row.name]}
                        namePrefix={[row.name]}
                        gutter={gutter}
                      />
                    ))}
                  </Row>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={rows.length <= min}
                    onClick={() => remove(row.name)}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                    aria-label="Remove item"
                  />
                </div>
              ))}

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                disabled={max !== undefined && rows.length >= max}
                onClick={() => add(buildRowTemplate(node))}
              >
                {config?.addText || 'Add item'}
              </Button>
            </Space>
          )}
        </Form.List>
      </div>
    </Col>
  );
}
