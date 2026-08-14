import { Alert, Button, Card, Col, Empty, Row, Select, Space, Switch, Tag, Typography } from 'antd';
import { useConsoleSettings } from '../lib/consoleSettings';
import { Page } from '../layout/Page';

/**
 * The host's side of the renderer contract, made adjustable.
 *
 * Everything here is `RendererConfigProvider`. It is a settings page because the
 * alternative — describing the config in a README — leaves the most important
 * property invisible: that a document's URL is *not* trusted, and a host's
 * credentials only ever reach an origin the host named. Turn the allowlist off
 * and watch a request stop carrying them.
 */
export function Settings() {
  const { settings, update, errors, clearErrors } = useConsoleSettings();

  return (
    <Page
      title="Settings"
      subtitle="How this console lets its documents reach the network."
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title="Requests">
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Space align="start" size={12}>
                  <Switch
                    checked={settings.offline}
                    onChange={(offline) => update({ offline })}
                  />
                  <Space orientation="vertical" size={0}>
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      Offline stub
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Swaps a `fetcher` into the provider, so the sample documents that read an API
                      still work with no network. The same seam a host uses to route requests
                      through its own HTTP client.
                    </Typography.Text>
                  </Space>
                </Space>

                <Space align="start" size={12}>
                  <Switch
                    checked={settings.blockUnlisted}
                    onChange={(blockUnlisted) => update({ blockUnlisted })}
                  />
                  <Space orientation="vertical" size={0}>
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      Block unlisted origins
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Refuse anything not on the list below, instead of fetching it
                      unauthenticated.
                    </Typography.Text>
                  </Space>
                </Space>
              </Space>
            </Card>

            <Card size="small" title="Allowed origins">
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  mode="tags"
                  value={settings.allowedOrigins}
                  onChange={(allowedOrigins) => update({ allowedOrigins })}
                  placeholder="https://api.example.com"
                  style={{ width: '100%' }}
                  tokenSeparators={[',', ' ']}
                />
                <Alert
                  type="warning"
                  showIcon
                  title="This list is a security boundary, not a convenience"
                  description={
                    <Typography.Text style={{ fontSize: 12 }}>
                      A document is a shareable file, so its URL is attacker-controlled in the
                      general case. Host headers and credentials are only ever sent to an origin on
                      this list; anything else is fetched the way it always was — unauthenticated.
                      Origins match exactly, because <code>evil-example.com</code> ends with{' '}
                      <code>example.com</code>.
                    </Typography.Text>
                  }
                />
              </Space>
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="Request errors"
            extra={
              errors.length > 0 ? (
                <Button size="small" onClick={clearErrors}>
                  Clear
                </Button>
              ) : null
            }
          >
            {errors.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Nothing has failed. Open the “Remote data” form — it carries a deliberate 404 —
                    or block the allowlist and load the catalogue.
                  </Typography.Text>
                }
              />
            ) : (
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {errors.map((error, index) => (
                  <Space key={`${error.code}-${index}`} orientation="vertical" size={2}>
                    <Space size={6}>
                      <Tag color="red">{error.code}</Tag>
                      {error.status ? <Tag>{error.status}</Tag> : null}
                      {error.kind ? <Tag>{error.kind}</Tag> : null}
                    </Space>
                    <Typography.Text style={{ fontSize: 12 }}>{error.message}</Typography.Text>
                    {error.url ? (
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {error.url}
                      </Typography.Text>
                    ) : null}
                  </Space>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Page>
  );
}
