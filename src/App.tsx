import { BuildOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import { Layout, Space, Tabs, Typography } from 'antd';
import { useState } from 'react';
import { BuilderLayout } from '@/builder/BuilderLayout';
import { Toolbar } from '@/builder/Toolbar';
import { JsonPane } from '@/panes/JsonPane';
import { PreviewPane } from '@/panes/PreviewPane';
import { useSchemaStore } from '@/store/useSchemaStore';

const HEADER_HEIGHT = 56;

export function App() {
  const schema = useSchemaStore((state) => state.schema);
  const [activeKey, setActiveKey] = useState('builder');

  return (
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
            antd Form Generator
          </Typography.Text>
          <Typography.Text type="secondary" className="fg-header__meta" style={{ fontSize: 12 }}>
            {schema.fields.length} field{schema.fields.length === 1 ? '' : 's'}
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
              children: <BuilderLayout />,
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
                  <PreviewPane schema={schema} />
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
                  <JsonPane />
                </div>
              ),
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
