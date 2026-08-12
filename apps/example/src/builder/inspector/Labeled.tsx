import { Typography } from 'antd';
import type { ReactNode } from 'react';

export interface LabeledProps {
  label: string;
  help?: string;
  status?: 'warning' | 'error';
  children: ReactNode;
}

/** Compact label + control row used throughout the inspector. */
export function Labeled({ label, help, status, children }: LabeledProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, display: 'block', marginBottom: 4 }}
      >
        {label}
      </Typography.Text>
      {children}
      {help ? (
        <Typography.Text
          type={status === 'warning' ? 'warning' : 'secondary'}
          style={{ fontSize: 11, display: 'block', marginTop: 4 }}
        >
          {help}
        </Typography.Text>
      ) : null}
    </div>
  );
}
