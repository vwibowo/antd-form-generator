import { ArrowLeftOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { BuilderWorkspace } from '@antd-form-generator/builder/BuilderWorkspace';
import type { DocumentKind } from '@antd-form-generator/core';
import { App, Button, Space } from 'antd';
import { Link } from 'react-router';
import { appCustomComponents } from '../custom';
import { readBuilderDocument, saveDocument } from '../lib/documentLibrary';

/** What the builder's mode switch last selected, so Publish takes the right one. */
function activeKind(): DocumentKind {
  try {
    const raw = localStorage.getItem('antd-form-generator:mode');
    const mode = raw ? (JSON.parse(raw) as { state?: { mode?: string } })?.state?.mode : null;
    return mode === 'table' || mode === 'workflow' ? mode : 'screen';
  } catch {
    return 'screen';
  }
}

function titleOf(schema: unknown, kind: DocumentKind): string {
  const named = (schema as { title?: unknown })?.title;
  if (typeof named === 'string' && named.trim()) return named;
  return `Untitled ${kind}`;
}

/**
 * The builder, mounted whole, plus the one control that closes the loop.
 *
 * This route deliberately sits outside `AppShell`: `BuilderWorkspace` brings its
 * own header and tabs and is sized to `100vh`, so the console's sider would
 * stack a second header on top of it and push the canvas off the page. A tool
 * that wants the whole window gets the whole window; the bar below floats over
 * it rather than taking layout space.
 *
 * Publish is what makes the demo a loop rather than two unrelated halves: it
 * copies whatever the builder currently has open into the console's own library,
 * where every other route can render it.
 */
export function BuilderRoute() {
  const { message } = App.useApp();

  const publish = () => {
    const kind = activeKind();
    const schema = readBuilderDocument(kind);
    if (!schema) {
      message.error('Nothing valid to publish yet');
      return;
    }
    const title = titleOf(schema, kind);
    saveDocument({
      // Stable per kind, so publishing twice replaces rather than piles up.
      id: `builder-${kind}`,
      kind,
      title,
      description: `Published from the builder`,
      source: 'builder',
      schema,
    });
    message.success(`Published “${title}” to the library`);
  };

  return (
    <>
      <BuilderWorkspace CustomComponents={appCustomComponents} title="Meridian Builder" />
      <Space
        size={8}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 20,
          background: '#fff',
          padding: 8,
          borderRadius: 10,
          boxShadow: '0 6px 20px rgba(5, 5, 5, 0.14)',
        }}
      >
        <Link to="/">
          <Button size="small" icon={<ArrowLeftOutlined />}>
            Console
          </Button>
        </Link>
        <Button size="small" type="primary" icon={<CloudUploadOutlined />} onClick={publish}>
          Publish to library
        </Button>
      </Space>
    </>
  );
}
