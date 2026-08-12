import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenSchema } from '@antd-form-generator/core/schema/screen';
import { createEmptyScreenSchema } from '@antd-form-generator/core/schema/screen';
import type { WorkflowNode } from '@antd-form-generator/core/schema/workflow';
import { collectWorkflowNames } from '@antd-form-generator/core/schema/workflowGraph';
import { nodeCaption } from '@antd-form-generator/core/schema/workflowRegistry';
import { ScreenStoreProvider } from '@/store/ScreenStoreContext';
import { createScreenStore } from '@/store/useScreenStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { BuilderLayout } from '../BuilderLayout';

export interface ScreenNodeEditorProps {
  node: WorkflowNode;
  onBack: () => void;
}

/**
 * The ordinary builder, bound to one workflow node's embedded screen.
 *
 * A scratch store mirrored back into the workflow document on change, rather
 * than reimplementing every builder action against the workflow store. This was
 * two files — one for form nodes, one for page nodes — which differed only in
 * which store they created and which setter they wrote back through.
 *
 * Because the screen is inside a workflow it gets things a standalone one
 * cannot have: the payload keys its conditions can test, and the earlier steps
 * a `summary` node can lay out.
 */
export function ScreenNodeEditor({ node, onBack }: ScreenNodeEditorProps) {
  const schema = useWorkflowStore((state) => state.schema);
  const setNodeScreen = useWorkflowStore((state) => state.setNodeScreen);

  // Created once per mount. `WorkflowBuilder` keys this by node id, so picking
  // another node remounts rather than reseeds.
  const [store] = useState(() => createScreenStore(node.screen ?? createEmptyScreenSchema()));
  const mirroredRef = useRef(node.screen);

  useEffect(
    () =>
      store.subscribe((state) => {
        // `subscribe` fires for selection too; the identity check keeps a click
        // from writing to the document.
        if (state.schema === mirroredRef.current) return;
        mirroredRef.current = state.schema;
        setNodeScreen(node.id, state.schema);
      }),
    [store, node.id, setNodeScreen],
  );

  useEffect(() => {
    // A workflow undo, or a JSON-tab edit, replaces this node's screen behind
    // the editor's back. Notice the incoming screen is not the one last written
    // out and reseed, or the next keystroke would push the stale copy over it.
    const incoming = node.screen ?? createEmptyScreenSchema();
    if (incoming === mirroredRef.current) return;
    mirroredRef.current = incoming;
    store.setState({ schema: incoming, past: [], future: [], selectedId: null });
  }, [node.screen, store]);

  const fieldChoices = useMemo(
    () =>
      collectWorkflowNames(schema)
        // Its own button key is not something this screen can test on itself.
        .filter((entry) => entry.nodeId !== node.id)
        .map((entry) => ({ label: `${entry.label} (${entry.name})`, value: entry.name })),
    [schema, node.id],
  );

  const { formSources, formLabels } = useMemo(() => {
    const sources: Record<string, ScreenSchema> = {};
    const labels: Record<string, string> = {};
    for (const entry of schema.nodes) {
      // Not itself: a screen cannot summarise the payload it is still collecting.
      if (entry.kind !== 'screen' || !entry.screen || entry.id === node.id) continue;
      sources[entry.id] = entry.screen;
      labels[entry.id] = nodeCaption(entry);
    }
    return { formSources: sources, formLabels: labels };
  }, [schema.nodes, node.id]);

  return (
    // Outside the `.fg-builder` grid: `.fg-builder__main > div` is absolutely
    // positioned, so nesting a second builder inside the middle pane
    // double-applies the height calc.
    <div className="fg-wf-formedit">
      <div className="fg-wf-formedit__bar">
        <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back to the graph
        </Button>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {nodeCaption(node)}
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>Screen</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Fields collect values; buttons are what branches out of this step test.
        </Typography.Text>
      </div>

      <ScreenStoreProvider store={store}>
        <BuilderLayout
          fieldChoices={fieldChoices}
          formSources={formSources}
          formLabels={formLabels}
        />
      </ScreenStoreProvider>
    </div>
  );
}
