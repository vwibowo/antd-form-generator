import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyPageSchema } from '@/schema/page';
import type { FormSchema } from '@/schema/schema';
import type { WorkflowNode } from '@/schema/workflow';
import { collectWorkflowNames } from '@/schema/workflowGraph';
import { nodeCaption } from '@/schema/workflowRegistry';
import { PageStoreProvider } from '@/store/PageStoreContext';
import { createPageStore } from '@/store/usePageStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { PageBuilder } from '../page/PageBuilder';

export interface PageNodeEditorProps {
  node: WorkflowNode;
  onBack: () => void;
}

/**
 * The ordinary page builder, bound to one workflow node's embedded page.
 *
 * Same shape as `FormNodeEditor`, and the same reasoning: a scratch store
 * mirrored back into the workflow document on change, rather than
 * reimplementing every page action against the workflow store.
 *
 * Because the page is inside a workflow, it gets things a standalone page
 * cannot have — the payload keys its conditions can test, and the form steps a
 * `summary` block can lay out.
 */
export function PageNodeEditor({ node, onBack }: PageNodeEditorProps) {
  const schema = useWorkflowStore((state) => state.schema);
  const setNodePage = useWorkflowStore((state) => state.setNodePage);

  // Created once per mount. `WorkflowBuilder` keys this by node id, so picking
  // another node remounts rather than reseeds.
  const [store] = useState(() => createPageStore(node.page ?? createEmptyPageSchema()));
  const mirroredRef = useRef(node.page);

  useEffect(
    () =>
      store.subscribe((state) => {
        // `subscribe` fires for selection too; the identity check keeps a click
        // from writing to the document.
        if (state.schema === mirroredRef.current) return;
        mirroredRef.current = state.schema;
        setNodePage(node.id, state.schema);
      }),
    [store, node.id, setNodePage],
  );

  useEffect(() => {
    // A workflow undo, or a JSON-tab edit, replaces this node's page behind the
    // editor's back. Notice the incoming page is not the one last written out
    // and reseed, or the next keystroke would push the stale copy over it.
    const incoming = node.page ?? createEmptyPageSchema();
    if (incoming === mirroredRef.current) return;
    mirroredRef.current = incoming;
    store.setState({ schema: incoming, past: [], future: [], selectedId: null });
  }, [node.page, store]);

  const fieldChoices = useMemo(
    () =>
      collectWorkflowNames(schema)
        // Its own button key is not something this page can test on itself.
        .filter((entry) => entry.nodeId !== node.id)
        .map((entry) => ({ label: `${entry.label} (${entry.name})`, value: entry.name })),
    [schema, node.id],
  );

  const { formSources, formLabels } = useMemo(() => {
    const sources: Record<string, FormSchema> = {};
    const labels: Record<string, string> = {};
    for (const entry of schema.nodes) {
      if (entry.kind !== 'form' || !entry.form) continue;
      sources[entry.id] = entry.form;
      labels[entry.id] = nodeCaption(entry);
    }
    return { formSources: sources, formLabels: labels };
  }, [schema.nodes]);

  return (
    // Outside the `.fg-builder` grid, for the reason `FormNodeEditor` documents:
    // `.fg-builder__main > div` is absolutely positioned, so nesting a second
    // builder inside the middle pane double-applies the height calc.
    <div className="fg-wf-formedit">
      <div className="fg-wf-formedit__bar">
        <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back to the graph
        </Button>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {nodeCaption(node)}
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>Page</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Buttons here are what branches out of this step test.
        </Typography.Text>
      </div>

      <PageStoreProvider store={store}>
        <PageBuilder
          fieldChoices={fieldChoices}
          formSources={formSources}
          formLabels={formLabels}
        />
      </PageStoreProvider>
    </div>
  );
}
