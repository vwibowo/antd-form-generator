import { BuildOutlined, CodeOutlined, EyeOutlined, ProfileOutlined } from '@ant-design/icons';
import { Layout, Segmented, Space, Tabs, Typography } from 'antd';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BuilderLayout } from '@/builder/BuilderLayout';
import { TableBuilder } from '@/builder/table/TableBuilder';
import { Toolbar } from '@/builder/Toolbar';
import { WorkflowBuilder } from '@/builder/workflow/WorkflowBuilder';
import { appCustomComponents } from '@/custom';
import { JsonPane, TableJsonPane, WorkflowJsonPane } from '@/panes/JsonPane';
import { PreviewPane } from '@/panes/PreviewPane';
import { SummaryPane } from '@/panes/SummaryPane';
import { TablePreviewPane } from '@/panes/TablePreviewPane';
import { WorkflowPreviewPane } from '@/panes/WorkflowPreviewPane';
import { CustomComponentsProvider } from '@/renderer/custom';
import type { DocumentKind } from '@/schema/document';
import { useAppMode } from '@/store/useAppMode';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useTableStore } from '@/store/useTableStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';

const HEADER_HEIGHT = 56;

export function App() {
  const schema = useSchemaStore((state) => state.schema);
  const tableSchema = useTableStore((state) => state.schema);
  const workflowSchema = useWorkflowStore((state) => state.schema);
  const mode = useAppMode((state) => state.mode);
  const setMode = useAppMode((state) => state.setMode);
  const [activeKey, setActiveKey] = useState('builder');

  const count =
    mode === 'table'
      ? tableSchema.columns.length
      : mode === 'workflow'
        ? workflowSchema.nodes.length
        : schema.fields.length;
  const noun = mode === 'table' ? 'column' : mode === 'workflow' ? 'step' : 'field';
  // Summary is a form-only tab. Deriving the key rather than resetting it means
  // a trip through another mode and back lands where you left off.
  const currentKey = mode !== 'form' && activeKey === 'summary' ? 'builder' : activeKey;

  // One entry per mode beats a three-way ternary in each tab, and adding a
  // fourth document would be three lines rather than three edits.
  const builders: Record<DocumentKind, ReactNode> = {
    form: <BuilderLayout />,
    table: <TableBuilder />,
    workflow: <WorkflowBuilder />,
  };

  const previews: Record<DocumentKind, ReactNode> = {
    form: <PreviewPane schema={schema} />,
    table: <TablePreviewPane schema={tableSchema} />,
    workflow: <WorkflowPreviewPane schema={workflowSchema} />,
  };

  const jsonPanes: Record<DocumentKind, ReactNode> = {
    form: <JsonPane />,
    table: <TableJsonPane />,
    workflow: <WorkflowJsonPane />,
  };

  const workspace = (
    <Layout style={{ height: '100vh' }}>
      <Layout.Header
        className="fg-header"
        style={{
          height: HEADER_HEIGHT,
          lineHeight: `${HEADER_HEIGHT}px`,
          padding: '0 16px',
          background: '#fff',
          borderBottom: '1px solid rgba(5, 5, 5, 0.06)',
        }}
      >
        <Space size={12}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            antd Generator
          </Typography.Text>
          {/* Which document the tabs below are editing. */}
          <Segmented
            size="small"
            value={mode}
            options={[
              { label: 'Form', value: 'form' },
              { label: 'Table', value: 'table' },
              { label: 'Workflow', value: 'workflow' },
            ]}
            onChange={(next) => setMode(next as DocumentKind)}
          />
          <Typography.Text type="secondary" className="fg-header__meta" style={{ fontSize: 12 }}>
            {count} {noun}
            {count === 1 ? '' : 's'}
          </Typography.Text>
        </Space>
        <Toolbar />
      </Layout.Header>

      <Layout.Content style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)`, overflow: 'hidden' }}>
        <Tabs
          activeKey={currentKey}
          onChange={setActiveKey}
          // Unmounting the preview between tab switches resets its form state,
          // which is what you want when the schema changed underneath it.
          destroyOnHidden
          tabBarStyle={{ margin: 0, padding: '0 16px', background: '#fff' }}
          style={{ height: '100%' }}
          items={[
            {
              key: 'builder',
              label: (
                <span>
                  <BuildOutlined /> Builder
                </span>
              ),
              children: builders[mode],
            },
            {
              key: 'preview',
              label: (
                <span>
                  <EyeOutlined /> Preview
                </span>
              ),
              children: (
                <div className="fg-scroll" style={{ height: '100%' }}>
                  {previews[mode]}
                </div>
              ),
            },
            // A table submits nothing, and a workflow's payload is spread over
            // several forms — neither has a single schema to summarise.
            ...(mode !== 'form'
              ? []
              : [
                  {
                    key: 'summary',
                    label: (
                      <span>
                        <ProfileOutlined /> Summary
                      </span>
                    ),
                    children: (
                      <div className="fg-scroll" style={{ height: '100%' }}>
                        <SummaryPane schema={schema} />
                      </div>
                    ),
                  },
                ]),
            {
              key: 'json',
              label: (
                <span>
                  <CodeOutlined /> JSON
                </span>
              ),
              children: (
                <div className="fg-scroll" style={{ height: '100%' }}>
                  {jsonPanes[mode]}
                </div>
              ),
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );

  // One registry for the whole app, so the palette, the canvas preview and the
  // rendered form all resolve `custom` fields the same way.
  return (
    <CustomComponentsProvider components={appCustomComponents}>{workspace}</CustomComponentsProvider>
  );
}
