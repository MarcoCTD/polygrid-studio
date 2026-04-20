import { useCallback } from 'react';
import { Columns3, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useProductsUIStore, type ColumnConfig } from '../productsUiStore';
import { COLUMN_LABELS } from '../columnLabels';

// ============================================================
// Sortable Column Item
// ============================================================

function SortableColumnItem({ col }: { col: ColumnConfig }) {
  const { toggleColumnVisible } = useProductsUIStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // select and name columns are always visible
  const isLocked = col.id === 'select' || col.id === 'name';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-text-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <Checkbox
        checked={col.visible}
        disabled={isLocked}
        onCheckedChange={() => {
          if (!isLocked) toggleColumnVisible(col.id);
        }}
      />
      <span className="text-sm text-text-primary">{COLUMN_LABELS[col.id] ?? col.id}</span>
    </div>
  );
}

// ============================================================
// ColumnSettings Popover
// ============================================================

export function ColumnSettings() {
  const { columnConfig, reorderColumns } = useProductsUIStore();
  const sorted = [...columnConfig].sort((a, b) => a.order - b.order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = sorted.findIndex((c) => c.id === active.id);
      const toIndex = sorted.findIndex((c) => c.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderColumns(fromIndex, toIndex);
      }
    },
    [sorted, reorderColumns],
  );

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-bg-hover">
        <Columns3 size={14} />
        <span>Spalten</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-xs font-medium text-text-secondary">Spalten konfigurieren</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5">
              {sorted.map((col) => (
                <SortableColumnItem key={col.id} col={col} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}
