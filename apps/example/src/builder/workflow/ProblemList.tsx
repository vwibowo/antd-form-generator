import { CheckCircleOutlined, CloseCircleFilled, WarningFilled } from '@ant-design/icons';
import { Typography } from 'antd';
import { useMemo } from 'react';
import { validateWorkflow } from '@antd-form-generator/core/schema/workflowGraph';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * Everything `validateWorkflow` found, as a click-to-select list.
 *
 * Advice, not a gate: nothing here blocks saving, exporting or previewing. It
 * sits under the settings so the empty-selection state is "here is the document
 * and here is what is wrong with it".
 */
export function ProblemList() {
  const schema = useWorkflowStore((state) => state.schema);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const selectEdge = useWorkflowStore((state) => state.selectEdge);

  const issues = useMemo(() => validateWorkflow(schema), [schema]);

  const errors = issues.filter((issue) => issue.level === 'error').length;

  return (
    <div style={{ marginTop: 20 }}>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
        Problems{issues.length > 0 ? ` (${issues.length})` : ''}
      </Typography.Text>

      {issues.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <CheckCircleOutlined style={{ color: '#52c41a', marginInlineEnd: 6 }} />
          Nothing to flag — every step is reachable and every branch resolves.
        </Typography.Text>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {issues.map((issue, index) => (
            <button
              key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? index}`}
              type="button"
              className="fg-wf-problem"
              onClick={() => {
                if (issue.nodeId) selectNode(issue.nodeId);
                else if (issue.edgeId) selectEdge(issue.edgeId);
              }}
            >
              {issue.level === 'error' ? (
                <CloseCircleFilled style={{ color: '#ff4d4f' }} />
              ) : (
                <WarningFilled style={{ color: '#faad14' }} />
              )}
              <span>{issue.message}</span>
            </button>
          ))}
        </div>
      )}

      {errors > 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          A run stops when it reaches a problem, and the Preview says where.
        </Typography.Text>
      ) : null}
    </div>
  );
}
