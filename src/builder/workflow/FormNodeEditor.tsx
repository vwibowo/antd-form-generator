import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { createEmptySchema } from '@/schema/schema';
import type { WorkflowNode } from '@/schema/workflow';
import { nodeCaption } from '@/schema/workflowRegistry';
import { SchemaStoreProvider } from '@/store/SchemaStoreContext';
import { createSchemaStore } from '@/store/useSchemaStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { BuilderLayout } from '../BuilderLayout';

export interface FormNodeEditorProps {
  node: WorkflowNode;
  onBack: () => void;
}

/**
 * The ordinary form builder, bound to one workflow node's embedded form.
 *
 * The node's form lives in a scratch store of its own, mirrored back into the
 * workflow document on every change. The alternative — reimplementing all
 * eleven form actions against the workflow store — would duplicate the drop
 * rules and the tree walking for no gain.
 *
 * Two histories exist as a result: the workflow's is authoritative and folds a
 * burst of edits into one undo step (see `COALESCE_MS`), while this store's own
 * undo works for as long as the editor stays open. They are not interleavable,
 * and a workflow-level undo resets this one.
 */
export function FormNodeEditor({ node, onBack }: FormNodeEditorProps) {
  const setNodeForm = useWorkflowStore((state) => state.setNodeForm);

  // Created once per mount. `WorkflowBuilder` keys this component by node id,
  // so picking a different node remounts rather than reseeds — syncing a live
  // store from props would fight whoever is typing into it.
  const [store] = useState(() => createSchemaStore(node.form ?? createEmptySchema()));
  const mirroredRef = useRef(node.form);

  useEffect(
    () =>
      store.subscribe((state) => {
        // `subscribe` fires for selection changes too; comparing identity is
        // what keeps a click from writing to the document.
        if (state.schema === mirroredRef.current) return;
        mirroredRef.current = state.schema;
        setNodeForm(node.id, state.schema);
      }),
    [store, node.id, setNodeForm],
  );

  useEffect(() => {
    // A workflow undo, or an edit in the JSON tab, replaces this node's form
    // behind the editor's back. Notice that the incoming form is not the one
    // last written out, and reseed — otherwise the next keystroke would push
    // the stale copy straight back over it.
    const incoming = node.form ?? createEmptySchema();
    if (incoming === mirroredRef.current) return;
    mirroredRef.current = incoming;
    store.setState({ schema: incoming, past: [], future: [], selectedId: null });
  }, [node.form, store]);

  return (
    // Outside the `.fg-builder` grid on purpose: `.fg-builder__main > div` is
    // absolutely positioned, so nesting a second builder inside the middle pane
    // would apply the full-height calc twice.
    <div className="fg-wf-formedit">
      <div className="fg-wf-formedit__bar">
        <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back to the graph
        </Button>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {nodeCaption(node)}
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>Form step</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Field names here are what branch conditions test.
        </Typography.Text>
      </div>

      <SchemaStoreProvider store={store}>
        <BuilderLayout />
      </SchemaStoreProvider>
    </div>
  );
}
