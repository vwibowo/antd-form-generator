import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons or tags for the top-right. */
  extra?: ReactNode;
  children: ReactNode;
}

/** One page header, so every route lines up without repeating the markup. */
export function Page({ title, subtitle, extra, children }: PageProps) {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Space orientation="vertical" size={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {subtitle}
            </Typography.Text>
          ) : null}
        </Space>
        {extra ? <div style={{ flexShrink: 0 }}>{extra}</div> : null}
      </div>
      {children}
    </div>
  );
}
