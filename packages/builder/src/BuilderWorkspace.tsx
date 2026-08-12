import { BuildOutlined, CodeOutlined, EyeOutlined, ProfileOutlined } from '@ant-design/icons';
import { Layout, Segmented, Space, Tabs, Typography } from 'antd';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BuilderLayout } from './BuilderLayout';
import { Toolbar } from './Toolbar';
import { ScreenJsonPane, TableJsonPane, WorkflowJsonPane } from './panes/JsonPane';
import { PreviewPane } from './panes/PreviewPane';
import { SummaryPane } from './panes/SummaryPane';
import { TablePreviewPane } from './panes/TablePreviewPane';
import { WorkflowPreviewPane } from './panes/WorkflowPreviewPane';
import { useAppMode } from './store/useAppMode';
import { useScreenStore } from './store/useScreenStore';
import { useTableStore } from './store/useTableStore';
import { useWorkflowStore } from './store/useWorkflowStore';
import { TableBuilder } from './table/TableBuilder';
import { WorkflowBuilder } from './workflow/WorkflowBuilder';
import { CustomComponentRegistry, CustomComponentsProvider } from '@antd-form-generator/core/renderer/custom';
import type { DocumentKind } from '@antd-form-generator/core/schema/document';

const HEADER_HEIGHT = 56;

export interface BuilderWorkspaceProps {
  CustomComponents?: CustomComponentRegistry
  title?:string
}

export function BuilderWorkspace(props: BuilderWorkspaceProps) {
  const schema = useScreenStore((state) => state.schema);
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
        : schema.nodes.length;
  const noun = mode === 'table' ? 'column' : mode === 'workflow' ? 'step' : 'node';
  // Summary is a screen-only tab. Deriving the key rather than resetting it
  // means a trip through another mode and back lands where you left off.
  const currentKey = mode !== 'screen' && activeKey === 'summary' ? 'builder' : activeKey;

  // One entry per mode beats a ternary in each tab, and another document would
  // be three lines rather than three edits.
  const builders: Record<DocumentKind, ReactNode> = {
    // A standalone screen has no run behind it, so no payload keys to offer a
    // condition — `ConditionEditor` takes a typed name instead.
    screen: <BuilderLayout />,
    table: <TableBuilder />,
    workflow: <WorkflowBuilder />,
  };

  const previews: Record<DocumentKind, ReactNode> = {
    screen: <PreviewPane schema={schema} />,
    table: <TablePreviewPane schema={tableSchema} />,
    workflow: <WorkflowPreviewPane schema={workflowSchema} />,
  };

  const jsonPanes: Record<DocumentKind, ReactNode> = {
    screen: <ScreenJsonPane />,
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
            {props.title || "antd Generator"}
          </Typography.Text>
          {/* Which document the tabs below are editing. */}
          <Segmented
            size="small"
            value={mode}
            options={[
              { label: 'Screen', value: 'screen' },
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
            // several screens — neither has a single schema to summarise.
            ...(mode !== 'screen'
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
    <CustomComponentsProvider components={props.CustomComponents || {}}>{workspace}</CustomComponentsProvider>
  );
}
