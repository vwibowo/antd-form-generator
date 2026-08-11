import {
  AlignLeftOutlined,
  BorderHorizontalOutlined,
  ColumnHeightOutlined,
  FontSizeOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  ProfileOutlined,
  TableOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { Typography } from 'antd';
import type { ReactNode } from 'react';
import type { PageBlockType } from '@/schema/page';
import { PAGE_BLOCK_CATEGORIES, pageBlocksByCategory } from '@/schema/pageRegistry';
import { usePageBuilderStore } from '@/store/PageStoreContext';
import { type BlockPaletteDragData, blockPaletteDraggableId } from './dndTypes';

const ICONS: Record<PageBlockType, ReactNode> = {
  heading: <FontSizeOutlined />,
  text: <AlignLeftOutlined />,
  image: <PictureOutlined />,
  alert: <InfoCircleOutlined />,
  dataList: <UnorderedListOutlined />,
  summary: <ProfileOutlined />,
  table: <TableOutlined />,
  divider: <BorderHorizontalOutlined />,
  spacer: <ColumnHeightOutlined />,
  actions: <ThunderboltOutlined />,
};

export function blockIcon(type: PageBlockType): ReactNode {
  return ICONS[type];
}

function PaletteItem({ type, label }: { type: PageBlockType; label: string }) {
  const addBlock = usePageBuilderStore((state) => state.addBlock);
  const data: BlockPaletteDragData = { source: 'page-palette', blockType: type };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: blockPaletteDraggableId(type),
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className="fg-palette-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      // Dragging is the primary gesture; clicking appends, as a
      // keyboard/touch-friendly fallback.
      onClick={() => addBlock(type)}
      {...listeners}
      {...attributes}
    >
      {ICONS[type]}
      <span>{label}</span>
    </div>
  );
}

export function BlockPalette() {
  return (
    <div style={{ padding: 12 }}>
      {PAGE_BLOCK_CATEGORIES.map((category) => {
        const metas = pageBlocksByCategory(category);
        if (metas.length === 0) return null;

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
            </div>
          </div>
        );
      })}

      <Typography.Paragraph type="secondary" style={{ fontSize: 11 }}>
        Text takes <Typography.Text code>{'{{field}}'}</Typography.Text> and fills it in from
        whatever the run has collected.
      </Typography.Paragraph>
    </div>
  );
}
