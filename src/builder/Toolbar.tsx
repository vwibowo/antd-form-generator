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
import { DEFAULT_WORKFLOW_PRESET, WORKFLOW_SAMPLE_PRESETS } from '@/schema/samples/workflows';
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
import {
  selectWorkflowCanRedo,
  selectWorkflowCanUndo,
  useWorkflowStore,
} from '@/store/useWorkflowStore';

/** Everything the toolbar needs about whichever document is on screen. */
interface ActiveDocument {
  document: unknown;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  presets: { key: string; label: string; description: string; create: () => unknown }[];
  defaultPresetKey: string;
  apply: (schema: unknown) => void;
  isEmpty: boolean;
  filename: string;
  /** The noun in "Undo restores your …" and in the Clear confirmation. */
  noun: string;
  clearTitle: string;
}

/**
 * One toolbar for all three documents. Every action dispatches to whichever
 * store the mode switch has active; import is the exception — it reads the
 * file's own `kind` and switches the mode to match what it was handed.
 *
 * The per-mode differences are gathered into one `switch` rather than spread
 * across a dozen ternaries in the JSX, which is what a third document turned
 * from untidy into unreadable.
 */
export function Toolbar() {
  const { message } = App.useApp();
  const mode = useAppMode((state) => state.mode);
  const setMode = useAppMode((state) => state.setMode);

  // Every store's hooks run unconditionally; the switch below only picks.
  const schema = useSchemaStore((state) => state.schema);
  const setSchema = useSchemaStore((state) => state.setSchema);
  const undoForm = useSchemaStore((state) => state.undo);
  const redoForm = useSchemaStore((state) => state.redo);
  const clearForm = useSchemaStore((state) => state.clear);
  const canUndoForm = useSchemaStore(selectCanUndo);
  const canRedoForm = useSchemaStore(selectCanRedo);

  const tableSchema = useTableStore((state) => state.schema);
  const setTableSchema = useTableStore((state) => state.setSchema);
  const undoTable = useTableStore((state) => state.undo);
  const redoTable = useTableStore((state) => state.redo);
  const clearTable = useTableStore((state) => state.clear);
  const canUndoTable = useTableStore(selectTableCanUndo);
  const canRedoTable = useTableStore(selectTableCanRedo);

  const workflowSchema = useWorkflowStore((state) => state.schema);
  const setWorkflowSchema = useWorkflowStore((state) => state.setSchema);
  const undoWorkflow = useWorkflowStore((state) => state.undo);
  const redoWorkflow = useWorkflowStore((state) => state.redo);
  const clearWorkflow = useWorkflowStore((state) => state.clear);
  const canUndoWorkflow = useWorkflowStore(selectWorkflowCanUndo);
  const canRedoWorkflow = useWorkflowStore(selectWorkflowCanRedo);

  const active: ActiveDocument =
    mode === 'table'
      ? {
          document: tableSchema,
          undo: undoTable,
          redo: redoTable,
          clear: clearTable,
          canUndo: canUndoTable,
          canRedo: canRedoTable,
          presets: TABLE_SAMPLE_PRESETS,
          defaultPresetKey: DEFAULT_TABLE_PRESET.key,
          apply: (next) => setTableSchema(next as typeof tableSchema),
          isEmpty: tableSchema.columns.length === 0,
          filename: 'table-schema.json',
          noun: 'table',
          clearTitle: 'Remove all columns?',
        }
      : mode === 'workflow'
        ? {
            document: workflowSchema,
            undo: undoWorkflow,
            redo: redoWorkflow,
            clear: clearWorkflow,
            canUndo: canUndoWorkflow,
            canRedo: canRedoWorkflow,
            presets: WORKFLOW_SAMPLE_PRESETS,
            defaultPresetKey: DEFAULT_WORKFLOW_PRESET.key,
            apply: (next) => setWorkflowSchema(next as typeof workflowSchema),
            isEmpty: workflowSchema.nodes.length === 0,
            filename: 'workflow-schema.json',
            noun: 'workflow',
            // Clear leaves a runnable start/end pair, not a blank canvas.
            clearTitle: 'Start this workflow over?',
          }
        : {
            document: schema,
            undo: undoForm,
            redo: redoForm,
            clear: clearForm,
            canUndo: canUndoForm,
            canRedo: canRedoForm,
            presets: SAMPLE_PRESETS,
            defaultPresetKey: DEFAULT_SAMPLE_PRESET.key,
            apply: (next) => setSchema(next as typeof schema),
            isEmpty: schema.fields.length === 0,
            filename: 'form-schema.json',
            noun: 'form',
            clearTitle: 'Remove all fields?',
          };

  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  // No confirmation: `setSchema` pushes the old document onto the undo stack,
  // so the button two along is a complete recovery.
  const applyPreset = (key: string) => {
    const preset = active.presets.find((entry) => entry.key === key);
    if (!preset) return;
    active.apply(preset.create());
    message.success(`Loaded "${preset.label}" — Undo restores your ${active.noun}`);
  };

  const sampleMenu: MenuProps = {
    items: active.presets.map((preset) => ({
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
    const blob = new Blob([JSON.stringify(active.document, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = active.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    message.success(`Exported ${active.filename}`);
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
      } else if (result.kind === 'workflow') {
        setWorkflowSchema(result.schema);
      } else {
        setSchema(result.schema);
      }
      setMode(result.kind);
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
            disabled={!active.canUndo}
            onClick={active.undo}
            aria-label="Undo"
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            size="small"
            icon={<RedoOutlined />}
            disabled={!active.canRedo}
            onClick={active.redo}
            aria-label="Redo"
          />
        </Tooltip>

        {/* Space.Compact rather than Dropdown.Button, which antd 6 deprecates. */}
        <Space.Compact>
          <Button
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => applyPreset(active.defaultPresetKey)}
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
          title={active.clearTitle}
          description="This can be undone with the undo button."
          okText="Clear"
          okButtonProps={{ danger: true }}
          onConfirm={active.clear}
        >
          <Button size="small" danger icon={<ClearOutlined />} disabled={active.isEmpty}>
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
