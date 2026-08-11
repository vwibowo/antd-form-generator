import { DeleteOutlined, PlusOutlined, SubnodeOutlined } from '@ant-design/icons';
import { Button, Input, Space, Tooltip, Typography } from 'antd';
import type { TreeOption } from '@/schema/schema';

export interface TreeOptionsEditorProps {
  options: TreeOption[];
  onChange: (options: TreeOption[]) => void;
}

/**
 * The nested option list behind `cascader` and `treeSelect`.
 *
 * Same shape as `OptionsEditor`, one level at a time: each row edits its own
 * label and value, and renders its children beneath itself indented. Every edit
 * rebuilds the branch it sits on rather than mutating in place, which is what
 * lets one `onChange` at the top carry a change made three levels down.
 *
 * Depth is capped because a cascader that deep is unusable, and because an
 * unbounded indent runs out of panel width long before that.
 */
const MAX_DEPTH = 4;
const INDENT = 14;

function Level({
  options,
  onChange,
  depth,
}: {
  options: TreeOption[];
  onChange: (options: TreeOption[]) => void;
  depth: number;
}) {
  const replace = (index: number, patch: Partial<TreeOption>) =>
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));

  return (
    <>
      {options.map((option, index) => {
        const children = option.children ?? [];

        return (
          <div
            key={index}
            style={{
              marginLeft: depth === 0 ? 0 : INDENT,
              // A rule down the left is what makes the nesting legible once
              // more than one branch is open.
              borderLeft: depth === 0 ? undefined : '1px solid rgba(5, 5, 5, 0.08)',
              paddingLeft: depth === 0 ? 0 : 8,
            }}
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <Input
                size="small"
                value={option.label}
                placeholder="Label"
                onChange={(event) => replace(index, { label: event.target.value })}
              />
              <Input
                size="small"
                value={String(option.value)}
                placeholder="Value"
                onChange={(event) => replace(index, { value: event.target.value })}
              />
              <Tooltip
                title={
                  depth + 1 >= MAX_DEPTH
                    ? `Nesting stops at ${MAX_DEPTH} levels`
                    : 'Add a child under this one'
                }
              >
                <Button
                  size="small"
                  type="text"
                  icon={<SubnodeOutlined />}
                  aria-label="Add a child option"
                  disabled={depth + 1 >= MAX_DEPTH}
                  onClick={() =>
                    replace(index, {
                      children: [
                        ...children,
                        {
                          label: `Option ${children.length + 1}`,
                          value: `${String(option.value)}-${children.length + 1}`,
                        },
                      ],
                    })
                  }
                />
              </Tooltip>
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label="Remove option"
                onClick={() => onChange(options.filter((_, i) => i !== index))}
              />
            </div>

            {children.length > 0 ? (
              <Level
                options={children}
                depth={depth + 1}
                onChange={(next) =>
                  // An empty child list is dropped rather than kept as `[]`, so
                  // a leaf reads as a leaf in the exported JSON.
                  replace(index, { children: next.length > 0 ? next : undefined })
                }
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function TreeOptionsEditor({ options, onChange }: TreeOptionsEditorProps) {
  return (
    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <Typography.Text type="secondary" style={{ flex: 1, fontSize: 11 }}>
          Label
        </Typography.Text>
        <Typography.Text type="secondary" style={{ flex: 1, fontSize: 11 }}>
          Value
        </Typography.Text>
        <span style={{ width: 56 }} />
      </div>

      <Level options={options} onChange={onChange} depth={0} />

      <Button
        size="small"
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() =>
          onChange([
            ...options,
            { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` },
          ])
        }
      >
        Add top-level option
      </Button>

      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        Hierarchical options are authored here only — a remote source returns a flat list, which
        cannot describe a tree.
      </Typography.Text>
    </Space>
  );
}
