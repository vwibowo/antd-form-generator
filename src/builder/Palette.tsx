import {
  AlignLeftOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  BarsOutlined,
  BgColorsOutlined,
  BorderHorizontalOutlined,
  BorderlessTableOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ColumnHeightOutlined,
  DownSquareOutlined,
  EditOutlined,
  FieldNumberOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PaperClipOutlined,
  PartitionOutlined,
  PictureOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SlidersOutlined,
  StarOutlined,
  SwapOutlined,
  SwapRightOutlined,
  TableOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { Input, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CustomComponentDef } from '@/renderer/custom';
import { useCustomComponents } from '@/renderer/custom';
import type { CreateNodeSeed } from '@/schema/factory';
import { NODE_CATEGORIES, nodesByCategory } from '@/schema/registry';
import type { ScreenNodeType } from '@/schema/screen';
import { useBuilderStore } from '@/store/ScreenStoreContext';
import { type PaletteDragData, paletteDraggableId } from './dndTypes';

const ICONS: Record<ScreenNodeType, ReactNode> = {
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
  spacer: <ColumnHeightOutlined />,
  group: <AppstoreOutlined />,
  card: <ProfileOutlined />,
  list: <UnorderedListOutlined />,
  tabs: <BorderlessTableOutlined />,
  custom: <ThunderboltOutlined />,
  heading: <FontSizeOutlined />,
  text: <AlignLeftOutlined />,
  image: <PictureOutlined />,
  alert: <InfoCircleOutlined />,
  dataList: <UnorderedListOutlined />,
  summary: <ProfileOutlined />,
  table: <TableOutlined />,
  actions: <ThunderboltOutlined />,
};

export function paletteIcon(type: ScreenNodeType): ReactNode {
  return ICONS[type];
}

function PaletteItem({
  type,
  label,
  componentKey,
  def,
}: {
  type: ScreenNodeType;
  label: string;
  /** Set for entries that stand for one registered custom component. */
  componentKey?: string;
  def?: CustomComponentDef;
}) {
  const addNode = useBuilderStore((state) => state.addNode);
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
        addNode(type, undefined, undefined, customSeed(componentKey, def))
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
): CreateNodeSeed | undefined {
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

  // Merging the form and page palettes put 38 entries across nine categories in
  // one column, which is more than anyone scans. The filter is not a nicety.
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const matches = useMemo(
    () => (label: string, type: string) =>
      term === '' || label.toLowerCase().includes(term) || type.toLowerCase().includes(term),
    [term],
  );

  return (
    <div style={{ padding: 12 }}>
      <Input.Search
        allowClear
        size="small"
        placeholder="Filter"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{ marginBottom: 12 }}
      />
      {NODE_CATEGORIES.map((category) => {
        const metas = nodesByCategory(category)
          .filter(
            // The bare `custom` type is only useful when something is registered
            // to put in it; the registry entries below replace it.
            (meta) => meta.type !== 'custom',
          )
          .filter((meta) => matches(meta.label, meta.type));
        const entries =
          category === 'Custom'
            ? customEntries.filter(([key, def]) => matches(def.label, key))
            : [];
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
