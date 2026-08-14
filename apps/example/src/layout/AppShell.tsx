import {
  AppstoreOutlined,
  BuildOutlined,
  DatabaseOutlined,
  HomeOutlined,
  ImportOutlined,
  InboxOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Space, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router';

const NAV = [
  { key: '/', icon: <HomeOutlined />, label: <Link to="/">Overview</Link> },
  { key: '/library', icon: <AppstoreOutlined />, label: <Link to="/library">Documents</Link> },
  { key: '/tables', icon: <DatabaseOutlined />, label: <Link to="/tables">Data</Link> },
  { key: '/submissions', icon: <InboxOutlined />, label: <Link to="/submissions">Inbox</Link> },
  { key: '/import', icon: <ImportOutlined />, label: <Link to="/import">Import</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Settings</Link> },
  { key: '/builder', icon: <BuildOutlined />, label: <Link to="/builder">Builder</Link> },
];

/**
 * The console's chrome: a sider, a title bar, and an outlet.
 *
 * `/builder` deliberately does not use this — see `App.tsx`. `BuilderWorkspace`
 * brings its own header and tab strip and is sized to `100vh`, so nesting it
 * here would stack two headers and push the canvas off the bottom of the page.
 * A route that wants the whole viewport gets the whole viewport.
 */
export function AppShell() {
  const { pathname } = useLocation();

  // Longest matching nav entry, so `/submissions/abc` still lights up Inbox.
  // `/` would prefix-match everything, so it only wins on an exact hit.
  const selected =
    NAV.map((entry) => entry.key)
      .filter((key) => (key === '/' ? pathname === '/' : pathname.startsWith(key)))
      .sort((a, b) => b.length - a.length)[0] ?? '/';

  return (
    <Layout style={{ height: '100vh' }}>
      <Layout.Sider theme="light" width={216} breakpoint="lg" collapsedWidth={0}>
        <div style={{ padding: '16px 20px 8px' }}>
          <Space orientation="vertical" size={0}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              Meridian Ops
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Everything below is JSON
            </Typography.Text>
          </Space>
        </div>
        <Menu mode="inline" selectedKeys={[selected]} items={NAV} style={{ borderInlineEnd: 0 }} />
      </Layout.Sider>

      <Layout>
        {/* Its own overflow rather than the builder's `.fg-scroll`: this console
            is meant to show what a host needs, and a host does not import the
            builder's stylesheet. */}
        <Layout.Content style={{ height: '100vh', overflowY: 'auto' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
