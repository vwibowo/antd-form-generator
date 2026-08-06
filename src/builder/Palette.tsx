import {
  AppstoreOutlined,
  BarsOutlined,
  BorderHorizontalOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DownSquareOutlined,
  EditOutlined,
  FieldNumberOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  LockOutlined,
  PaperClipOutlined,
  ProfileOutlined,
  SlidersOutlined,
  StarOutlined,
  SwapOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { Typography } from 'antd';
import type { ReactNode } from 'react';
import { FIELD_CATEGORIES, fieldsByCategory } from '@/schema/registry';
import type { FieldType } from '@/schema/schema';
import { useSchemaStore } from '@/store/useSchemaStore';
import { type PaletteDragData, paletteDraggableId } from './dndTypes';

const ICONS: Record<FieldType, ReactNode> = {
  input: <EditOutlined />,
  textarea: <FileTextOutlined />,
  password: <LockOutlined />,
  number: <FieldNumberOutlined />,
  select: <DownSquareOutlined />,
  radio: <CheckSquareOutlined />,
  checkboxGroup: <BarsOutlined />,
  checkbox: <CheckSquareOutlined />,
  switch: <SwapOutlined />,
  date: <CalendarOutlined />,
  dateRange: <CalendarOutlined />,
  time: <ClockCircleOutlined />,
  slider: <SlidersOutlined />,
  rate: <StarOutlined />,
  upload: <PaperClipOutlined />,
  divider: <BorderHorizontalOutlined />,
  title: <FontSizeOutlined />,
  group: <AppstoreOutlined />,
  card: <ProfileOutlined />,
  list: <UnorderedListOutlined />,
};

export function paletteIcon(type: FieldType): ReactNode {
  return ICONS[type];
}

function PaletteItem({ type, label }: { type: FieldType; label: string }) {
  const addField = useSchemaStore((state) => state.addField);
  const data: PaletteDragData = { source: 'palette', fieldType: type };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteDraggableId(type),
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className="fg-palette-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      // Dragging is the primary gesture; clicking appends to the root as a
      // keyboard/touch-friendly fallback.
      onClick={() => addField(type)}
      {...listeners}
      {...attributes}
    >
      {ICONS[type]}
      <span>{label}</span>
    </div>
  );
}

export function Palette() {
  return (
    <div style={{ padding: 12 }}>
      {FIELD_CATEGORIES.map((category) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}
          >
            {category}
          </Typography.Text>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {fieldsByCategory(category).map((meta) => (
              <PaletteItem key={meta.type} type={meta.type} label={meta.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
