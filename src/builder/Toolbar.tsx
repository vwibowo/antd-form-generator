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
import { parseDocument } from '@/schema/document';
import { DEFAULT_SAMPLE_PRESET, SAMPLE_PRESETS } from '@/schema/samples';
import { DEFAULT_TABLE_PRESET, TABLE_SAMPLE_PRESETS } from '@/schema/samples/tables';
import { useAppMode } from '@/store/useAppMode';
import {
  selectCanRedo,
  selectCanUndo,
  useSchemaStore,
} from '@/store/useSchemaStore';
import {
  selectTableCanRedo,
  selectTableCanUndo,
  useTableStore,
} from '@/store/useTableStore';

/**
 * One toolbar for both documents. Every action dispatches to whichever store
 * the mode switch has active; import is the exception — it reads the file's own
 * `kind` and switches the mode to match what it was handed.
 */
export function Toolbar() {
  const { message } = App.useApp();
  const mode = useAppMode((state) => state.mode);
  const setMode = useAppMode((state) => state.setMode);

  const schema = useSchemaStore((state) => state.schema);
  const setSchema = useSchemaStore((state) => state.setSchema);
  const tableSchema = useTableStore((state) => state.schema);
  const setTableSchema = useTableStore((state) => state.setSchema);

  const isTable = mode === 'table';
  const activeDocument = isTable ? tableSchema : schema;

  const undoForm = useSchemaStore((state) => state.undo);
  const redoForm = useSchemaStore((state) => state.redo);
  const clearForm = useSchemaStore((state) => state.clear);
  const undoTable = useTableStore((state) => state.undo);
  const redoTable = useTableStore((state) => state.redo);
  const clearTable = useTableStore((state) => state.clear);

  const undo = isTable ? undoTable : undoForm;
  const redo = isTable ? redoTable : redoForm;
  const clear = isTable ? clearTable : clearForm;
  const canUndo = useSchemaStore(selectCanUndo);
  const canRedo = useSchemaStore(selectCanRedo);
  const canUndoTable = useTableStore(selectTableCanUndo);
  const canRedoTable = useTableStore(selectTableCanRedo);

  const presets = isTable ? TABLE_SAMPLE_PRESETS : SAMPLE_PRESETS;
  const defaultPreset = isTable ? DEFAULT_TABLE_PRESET : DEFAULT_SAMPLE_PRESET;
  const isEmpty = isTable ? tableSchema.columns.length === 0 : schema.fields.length === 0;

  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  // No confirmation on either branch: `setSchema` pushes the old document onto
  // the undo stack, so the button two along is a complete recovery.
  const applyPreset = (key: string) => {
    if (isTable) {
      const preset = TABLE_SAMPLE_PRESETS.find((entry) => entry.key === key);
      if (!preset) return;
      setTableSchema(preset.create());
      message.success(`Loaded "${preset.label}" — Undo restores your table`);
      return;
    }

    const preset = SAMPLE_PRESETS.find((entry) => entry.key === key);
    if (!preset) return;
    setSchema(preset.create());
    message.success(`Loaded "${preset.label}" — Undo restores your form`);
  };

  const sampleMenu: MenuProps = {
    items: presets.map((preset) => ({
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
    const filename = isTable ? 'table-schema.json' : 'form-schema.json';
    const blob = new Blob([JSON.stringify(activeDocument, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    message.success(`Exported ${filename}`);
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
      const result = parseDocument(parsed);
      if (!result.ok) {
        // The current document stays put — a bad file never destroys work.
        setImportErrors(result.errors);
        return;
      }
      // Follow the file rather than the switch: a table dropped in form mode
      // should open, not fail validation against the wrong contract.
      if (result.kind === 'table') {
        setTableSchema(result.schema);
        setMode('table');
      } else {
        setSchema(result.schema);
        setMode('form');
      }
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
            disabled={isTable ? !canUndoTable : !canUndo}
            onClick={undo}
            aria-label="Undo"
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            size="small"
            icon={<RedoOutlined />}
            disabled={isTable ? !canRedoTable : !canRedo}
            onClick={redo}
            aria-label="Redo"
          />
        </Tooltip>

        {/* Space.Compact rather than Dropdown.Button, which antd 6 deprecates. */}
        <Space.Compact>
          <Button
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => applyPreset(defaultPreset.key)}
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
          title={isTable ? 'Remove all columns?' : 'Remove all fields?'}
          description="This can be undone with the undo button."
          okText="Clear"
          okButtonProps={{ danger: true }}
          onConfirm={clear}
        >
          <Button size="small" danger icon={<ClearOutlined />} disabled={isEmpty}>
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
          The current document was left unchanged.
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
