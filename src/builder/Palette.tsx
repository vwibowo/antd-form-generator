import {
  ApartmentOutlined,
  AppstoreOutlined,
  BarsOutlined,
  BgColorsOutlined,
  BorderHorizontalOutlined,
  BorderlessTableOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DownSquareOutlined,
  EditOutlined,
  FieldNumberOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  HistoryOutlined,
  LockOutlined,
  PaperClipOutlined,
  PartitionOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SlidersOutlined,
  StarOutlined,
  SwapOutlined,
  SwapRightOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { Typography } from 'antd';
import type { ReactNode } from 'react';
import type { CustomComponentDef } from '@/renderer/custom';
import { useCustomComponents } from '@/renderer/custom';
import type { CreateFieldSeed } from '@/schema/factory';
import { FIELD_CATEGORIES, fieldsByCategory } from '@/schema/registry';
import type { FieldType } from '@/schema/schema';
import { useFormBuilderStore } from '@/store/SchemaStoreContext';
import { type PaletteDragData, paletteDraggableId } from './dndTypes';

const ICONS: Record<FieldType, ReactNode> = {
  input: <EditOutlined />,
  textarea: <FileTextOutlined />,
  password: <LockOutlined />,
  number: <FieldNumberOutlined />,
  otp: <SafetyCertificateOutlined />,
  autoComplete: <SearchOutlined />,
  mentions: <UserSwitchOutlined />,
  select: <DownSquareOutlined />,
  radio: <CheckSquareOutlined />,
  segmented: <BorderlessTableOutlined />,
  cascader: <PartitionOutlined />,
  treeSelect: <ApartmentOutlined />,
  transfer: <SwapRightOutlined />,
  checkboxGroup: <BarsOutlined />,
  checkbox: <CheckSquareOutlined />,
  switch: <SwapOutlined />,
  date: <CalendarOutlined />,
  dateRange: <CalendarOutlined />,
  time: <ClockCircleOutlined />,
  timeRange: <HistoryOutlined />,
  slider: <SlidersOutlined />,
  rate: <StarOutlined />,
  colorPicker: <BgColorsOutlined />,
  upload: <PaperClipOutlined />,
  divider: <BorderHorizontalOutlined />,
  title: <FontSizeOutlined />,
  group: <AppstoreOutlined />,
  card: <ProfileOutlined />,
  list: <UnorderedListOutlined />,
  custom: <ThunderboltOutlined />,
};

export function paletteIcon(type: FieldType): ReactNode {
  return ICONS[type];
}

function PaletteItem({
  type,
  label,
  componentKey,
  def,
}: {
  type: FieldType;
  label: string;
  /** Set for entries that stand for one registered custom component. */
  componentKey?: string;
  def?: CustomComponentDef;
}) {
  const addField = useFormBuilderStore((state) => state.addField);
  const data: PaletteDragData = { source: 'palette', fieldType: type, componentKey };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteDraggableId(type, componentKey),
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className="fg-palette-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      // Dragging is the primary gesture; clicking appends to the root as a
      // keyboard/touch-friendly fallback.
      onClick={() =>
        addField(type, undefined, undefined, customSeed(componentKey, def))
      }
      {...listeners}
      {...attributes}
    >
      {def?.icon ?? ICONS[type]}
      <span>{label}</span>
    </div>
  );
}

/**
 * Seed that makes a dropped `custom` node arrive with its component chosen and
 * the component's own defaults applied.
 */
export function customSeed(
  componentKey: string | undefined,
  def: CustomComponentDef | undefined,
): CreateFieldSeed | undefined {
  if (!componentKey) return undefined;
  return {
    namePrefix: def?.defaults?.namePrefix ?? componentKey,
    label: def?.defaults?.label ?? def?.label,
    props: { component: componentKey, ...(def?.defaults?.props ?? {}) },
  };
}

export function Palette() {
  // Registered components become palette entries of their own, so a custom
  // control is dragged in exactly like a built-in one.
  const customComponents = useCustomComponents();
  const customEntries = Object.entries(customComponents);

  return (
    <div style={{ padding: 12 }}>
      {FIELD_CATEGORIES.map((category) => {
        const metas = fieldsByCategory(category).filter(
          // The bare `custom` type is only useful when something is registered
          // to put in it; the registry entries below replace it.
          (meta) => meta.type !== 'custom',
        );
        const entries = category === 'Custom' ? customEntries : [];
        if (metas.length === 0 && entries.length === 0) return null;

        return (
          <div key={category} style={{ marginBottom: 16 }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}
            >
              {category}
            </Typography.Text>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {metas.map((meta) => (
                <PaletteItem key={meta.type} type={meta.type} label={meta.label} />
              ))}
              {entries.map(([key, def]) => (
                <PaletteItem key={key} type="custom" label={def.label} componentKey={key} def={def} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
