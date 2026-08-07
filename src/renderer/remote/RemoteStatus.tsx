import { Typography } from 'antd';
import type { FieldNode } from '@/schema/schema';
import type { RemoteOptionsState } from './useRemoteOptions';

export interface RemoteStatusProps {
  node: FieldNode;
  state: RemoteOptionsState;
}

/**
 * Rendered into `Form.Item extra`, so it sits under the control without
 * displacing the field's authored `extra` text.
 */
export function RemoteStatus({ node, state }: RemoteStatusProps) {
  // Radio and checkbox groups have no antd `loading` prop, so this line is the
  // only feedback they get while a request is in flight.
  const showLoading = state.loading && node.type !== 'select';

  const status = (() => {
    if (state.missingDeps.length > 0) {
      return (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Select {state.missingDeps.join(', ')} first
        </Typography.Text>
      );
    }
    if (state.error) {
      return (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>
          Could not load options — {state.error}
        </Typography.Text>
      );
    }
    if (showLoading) {
      return (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Loading options…
        </Typography.Text>
      );
    }
    return null;
  })();

  if (!node.extra && !status) return null;

  return (
    <>
      {node.extra}
      {node.extra && status ? <br /> : null}
      {status}
    </>
  );
}
