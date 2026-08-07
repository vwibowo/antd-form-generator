import {
  ClearOutlined,
  DownOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  RedoOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  App,
  Button,
  Dropdown,
  Modal,
  Popconfirm,
  Space,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { useState } from 'react';
import { DEFAULT_SAMPLE_PRESET, SAMPLE_PRESETS } from '@/schema/samples';
import { parseFormSchema } from '@/schema/schema';
import {
  selectCanRedo,
  selectCanUndo,
  useSchemaStore,
} from '@/store/useSchemaStore';

export function Toolbar() {
  const { message } = App.useApp();
  const schema = useSchemaStore((state) => state.schema);
  const setSchema = useSchemaStore((state) => state.setSchema);
  const undo = useSchemaStore((state) => state.undo);
  const redo = useSchemaStore((state) => state.redo);
  const clear = useSchemaStore((state) => state.clear);
  const canUndo = useSchemaStore(selectCanUndo);
  const canRedo = useSchemaStore(selectCanRedo);

  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  const applyPreset = (key: string) => {
    const preset = SAMPLE_PRESETS.find((entry) => entry.key === key);
    if (!preset) return;
    // No confirmation: `setSchema` pushes the old schema onto the undo stack,
    // so the button two along is a complete recovery.
    setSchema(preset.create());
    message.success(`Loaded "${preset.label}" — Undo restores your form`);
  };

  const sampleMenu: MenuProps = {
    items: SAMPLE_PRESETS.map((preset) => ({
      key: preset.key,
      // antd menu items are a fixed-height nowrap line with an ellipsis, so a
      // two-line label needs these overrides or the description is clipped.
      style: { height: 'auto', lineHeight: 1.4, paddingBlock: 6, whiteSpace: 'normal' },
      label: (
        <div style={{ maxWidth: 280 }}>
          <div style={{ fontWeight: 500 }}>{preset.label}</div>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, whiteSpace: 'normal', display: 'block' }}
          >
            {preset.description}
          </Typography.Text>
        </div>
      ),
    })),
    onClick: ({ key }) => applyPreset(key),
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'form-schema.json';
    anchor.click();
    URL.revokeObjectURL(url);
    message.success('Exported form-schema.json');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (error) {
        setImportErrors([error instanceof Error ? error.message : 'File is not valid JSON']);
        return;
      }
      const result = parseFormSchema(parsed);
      if (!result.ok) {
        // The current schema stays put — a bad file never destroys work.
        setImportErrors(result.errors);
        return;
      }
      setSchema(result.schema);
      message.success(`Imported ${file.name}`);
    };
    reader.onerror = () => setImportErrors(['Could not read the file']);
    reader.readAsText(file);
  };

  return (
    <>
      <Space size={4}>
        <Tooltip title="Undo">
          <Button
            size="small"
            icon={<UndoOutlined />}
            disabled={!canUndo}
            onClick={undo}
            aria-label="Undo"
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            size="small"
            icon={<RedoOutlined />}
            disabled={!canRedo}
            onClick={redo}
            aria-label="Redo"
          />
        </Tooltip>

        {/* Space.Compact rather than Dropdown.Button, which antd 6 deprecates. */}
        <Space.Compact>
          <Button
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => applyPreset(DEFAULT_SAMPLE_PRESET.key)}
          >
            Sample
          </Button>
          <Dropdown menu={sampleMenu} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<DownOutlined />} aria-label="Choose a sample preset" />
          </Dropdown>
        </Space.Compact>

        <Upload
          accept="application/json,.json"
          showUploadList={false}
          beforeUpload={(file) => {
            handleImport(file);
            return false; // No upload endpoint — read it locally.
          }}
        >
          <Button size="small" icon={<UploadOutlined />}>
            Import
          </Button>
        </Upload>

        <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
          Export
        </Button>

        <Popconfirm
          title="Remove all fields?"
          description="This can be undone with the undo button."
          okText="Clear"
          okButtonProps={{ danger: true }}
          onConfirm={clear}
        >
          <Button size="small" danger icon={<ClearOutlined />} disabled={schema.fields.length === 0}>
            Clear
          </Button>
        </Popconfirm>
      </Space>

      <Modal
        open={importErrors !== null}
        onCancel={() => setImportErrors(null)}
        onOk={() => setImportErrors(null)}
        title="Import failed"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Typography.Paragraph type="secondary">
          The current form was left unchanged.
        </Typography.Paragraph>
        <ul style={{ paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
          {(importErrors ?? []).slice(0, 20).map((error) => (
            <li key={error} style={{ fontSize: 12 }}>
              {error}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
