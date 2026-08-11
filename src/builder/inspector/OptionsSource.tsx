import { Segmented, Space } from 'antd';
import type { ScreenNode } from '@/schema/screen';
import { dataSourceSchema } from '@/schema/screen';
import { OptionsEditor } from './OptionsEditor';
import { RemoteSourceEditor } from './RemoteSourceEditor';

export interface OptionsSourceProps {
  node: ScreenNode;
  onPatch: (patch: Partial<ScreenNode>) => void;
  fieldChoices: { label: string; value: string }[];
}

/** Static option list, or a remote source. Switching between them is lossless. */
export function OptionsSource({ node, onPatch, fieldChoices }: OptionsSourceProps) {
  const mode = node.dataSource ? 'remote' : 'static';

  return (
    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
      <Segmented
        size="small"
        block
        value={mode}
        options={[
          { label: 'Static', value: 'static' },
          { label: 'Remote', value: 'remote' },
        ]}
        onChange={(next) =>
          onPatch({
            // `dataSourceSchema.parse({})` rather than a hand-written literal, so
            // the seed cannot drift from the schema's defaults. `node.options` is
            // left alone, which is what makes switching back lossless.
            //
            // Clearing writes the key as `undefined` — `updateNode` uses
            // Object.assign, so it stays present but empty. Harmless:
            // JSON.stringify drops it and `z.optional()` accepts it.
            dataSource: next === 'remote' ? dataSourceSchema.parse({}) : undefined,
          })
        }
      />

      {node.dataSource ? (
        <RemoteSourceEditor
          node={node}
          source={node.dataSource}
          onChange={(dataSource) => onPatch({ dataSource })}
          fieldChoices={fieldChoices}
        />
      ) : (
        <OptionsEditor
          options={node.options ?? []}
          onChange={(options) => onPatch({ options })}
        />
      )}
    </Space>
  );
}
