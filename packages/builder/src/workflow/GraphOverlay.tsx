import { ClusterOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { autoLayout } from './autoLayout';

/**
 * Canvas controls, pinned to a corner of the stage.
 *
 * Not in the shared `Toolbar`: that one already carries three documents' worth
 * of conditionals, and this only ever applies to a graph.
 */
export function GraphOverlay() {
  const schema = useWorkflowStore((state) => state.schema);
  const setNodePositions = useWorkflowStore((state) => state.setNodePositions);

  return (
    <div className="fg-wf-overlay">
      <Tooltip title="Lay the steps out in columns. Undo puts them back.">
        <Button
          size="small"
          icon={<ClusterOutlined />}
          disabled={schema.nodes.length === 0}
          // Computed here and committed as one patch, so the store stays free
          // of layout code and Arrange is a single undo step.
          onClick={() => setNodePositions(autoLayout(schema))}
        >
          Arrange
        </Button>
      </Tooltip>
    </div>
  );
}
