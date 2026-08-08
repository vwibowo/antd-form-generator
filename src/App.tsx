import { BuildOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import { Layout, Segmented, Space, Tabs, Typography } from 'antd';
import { useState } from 'react';
import { BuilderLayout } from '@/builder/BuilderLayout';
import { TableBuilder } from '@/builder/table/TableBuilder';
import { Toolbar } from '@/builder/Toolbar';
import { appCustomComponents } from '@/custom';
import { JsonPane, TableJsonPane } from '@/panes/JsonPane';
import { PreviewPane } from '@/panes/PreviewPane';
import { TablePreviewPane } from '@/panes/TablePreviewPane';
import { CustomComponentsProvider } from '@/renderer/custom';
import { useAppMode } from '@/store/useAppMode';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useTableStore } from '@/store/useTableStore';

const HEADER_HEIGHT = 56;

export function App() {
  const schema = useSchemaStore((state) => state.schema);
  const tableSchema = useTableStore((state) => state.schema);
  const mode = useAppMode((state) => state.mode);
  const setMode = useAppMode((state) => state.setMode);
  const [activeKey, setActiveKey] = useState('builder');

  const isTable = mode === 'table';
  const count = isTable ? tableSchema.columns.length : schema.fields.length;
  const noun = isTable ? 'column' : 'field';

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
          {/* Which document the three tabs below are editing. */}
          <Segmented
            size="small"
            value={mode}
            options={[
              { label: 'Form', value: 'form' },
              { label: 'Table', value: 'table' },
            ]}
            onChange={(next) => setMode(next as 'form' | 'table')}
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
          activeKey={activeKey}
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
              children: isTable ? <TableBuilder /> : <BuilderLayout />,
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
                  {isTable ? (
                    <TablePreviewPane schema={tableSchema} />
                  ) : (
                    <PreviewPane schema={schema} />
                  )}
                </div>
              ),
            },
            {
              key: 'json',
              label: (
                <span>
                  <CodeOutlined /> JSON
                </span>
              ),
              children: (
                <div className="fg-scroll" style={{ height: '100%' }}>
                  {isTable ? <TableJsonPane /> : <JsonPane />}
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
