import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  FilterX,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '../schemas';
import { completeTask, getTaskListItems, updateTask, type TaskListItem } from '../services';
import { isOverdue, parseISODate } from '../utils/dateHelpers';
import { EntityLink } from './EntityLink';
import { PriorityBadge } from './PriorityBadge';

type LinkType = 'product' | 'order' | 'listing' | 'none';

interface ListViewProps {
  refreshKey?: number;
  /** Überfällig-Filter beim Öffnen vorsetzen (z.B. aus Search-Params) */
  initialOverdueOnly?: boolean;
  onOpenTask: (task: TaskListItem) => void;
  onChanged?: () => void | Promise<void>;
}

const ROW_HEIGHT = 50;
const TITLE_COL_MIN_WIDTH = 260;
const columnHelper = createColumnHelper<TaskListItem>();

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
  cancelled: 'Abgebrochen',
};

const STATUS_CLASSES: Record<TaskStatus, string> = {
  todo: 'border-border-subtle text-text-secondary',
  in_progress: 'border-pg-accent bg-pg-accent-subtle text-pg-accent',
  done: 'border-success bg-success-subtle text-success',
  cancelled: 'border-text-muted bg-bg-secondary text-text-muted',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const LINK_LABELS: Record<LinkType, string> = {
  product: 'Produkt',
  order: 'Auftrag',
  listing: 'Listing',
  none: 'Keine',
};

function formatDate(date: string | null): string {
  if (!date) return '-';
  const parsed = parseISODate(date);
  return `${String(parsed.getDate()).padStart(2, '0')}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${parsed.getFullYear()}`;
}

function taskLinkType(task: TaskListItem): LinkType {
  if (task.product_id) return 'product';
  if (task.order_id) return 'order';
  if (task.listing_id) return 'listing';
  return 'none';
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="size-3" />;
  if (sorted === 'desc') return <ArrowDown className="size-3" />;
  return <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-50" />;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const icon =
    status === 'done' ? (
      <CheckCircle2 className="size-3" />
    ) : status === 'cancelled' ? (
      <XCircle className="size-3" />
    ) : status === 'in_progress' ? (
      <RotateCcw className="size-3" />
    ) : (
      <Circle className="size-3" />
    );

  return (
    <Badge variant="outline" className={cn('gap-1', STATUS_CLASSES[status])}>
      {icon}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function colStyle(size: number | undefined): CSSProperties {
  if (size === undefined || size === 99999) {
    return { flex: '1 1 0%', minWidth: TITLE_COL_MIN_WIDTH, overflow: 'hidden' };
  }

  return { flex: '0 0 auto', width: size };
}

function computeTotalMinWidth(columns: ColumnDef<TaskListItem, unknown>[]): number {
  return columns.reduce((sum, column) => {
    const size = column.size;
    if (size === undefined) return sum + 100;
    if (size === 99999) return sum + TITLE_COL_MIN_WIDTH;
    return sum + size;
  }, 0);
}

function toggleFilterValue<T extends string>(values: T[], value: T, checked: boolean): T[] {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((item) => item !== value);
}

export function ListView({
  refreshKey = 0,
  initialOverdueOnly = false,
  onOpenTask,
  onChanged,
}: ListViewProps) {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority', desc: false },
    { id: 'due_date', desc: false },
  ]);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<TaskPriority[]>([]);
  const [linkFilters, setLinkFilters] = useState<LinkType[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(initialOverdueOnly);
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await getTaskListItems({ includeDone: showDone });
      setTasks(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufgaben konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [showDone]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks, refreshKey]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (statusFilters.length > 0 && !statusFilters.includes(task.status)) return false;
        if (priorityFilters.length > 0 && !priorityFilters.includes(task.priority)) return false;
        if (linkFilters.length > 0 && !linkFilters.includes(taskLinkType(task))) return false;
        if (overdueOnly && !isOverdue(task.due_date, task.status)) return false;
        if (recurringOnly && !task.recurring_rule) return false;
        return true;
      }),
    [linkFilters, overdueOnly, priorityFilters, recurringOnly, statusFilters, tasks],
  );

  const activeFilterCount =
    statusFilters.length +
    priorityFilters.length +
    linkFilters.length +
    (overdueOnly ? 1 : 0) +
    (recurringOnly ? 1 : 0);

  const clearFilters = () => {
    setStatusFilters([]);
    setPriorityFilters([]);
    setLinkFilters([]);
    setOverdueOnly(false);
    setRecurringOnly(false);
  };

  const handleToggleDone = useCallback(
    async (task: TaskListItem, checked: boolean) => {
      try {
        if (checked) {
          await completeTask(task.id);
          toast.success('Aufgabe erledigt');
        } else {
          await updateTask(task.id, { status: 'todo' });
          toast.success('Aufgabe wieder geöffnet');
        }
        await loadTasks();
        await onChanged?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Aufgabe konnte nicht aktualisiert werden',
        );
      }
    },
    [loadTasks, onChanged],
  );

  const columns = useMemo(
    () =>
      [
        columnHelper.display({
          id: 'done',
          size: 40,
          header: '',
          cell: ({ row }) => {
            const task = row.original;
            return (
              <Checkbox
                checked={task.status === 'done'}
                disabled={task.status === 'cancelled'}
                aria-label={`Aufgabe ${task.title} erledigt umschalten`}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={(checked) => void handleToggleDone(task, Boolean(checked))}
              />
            );
          },
          enableSorting: false,
        }),
        columnHelper.accessor('title', {
          header: 'Titel',
          size: 99999,
          cell: ({ row, getValue }) => (
            <button
              type="button"
              className={cn(
                'min-w-0 truncate text-left text-sm font-medium text-text-primary hover:text-pg-accent',
                row.original.status === 'done' && 'line-through',
              )}
              title={getValue()}
              onClick={(event) => {
                event.stopPropagation();
                onOpenTask(row.original);
              }}
            >
              {getValue()}
            </button>
          ),
          sortingFn: 'alphanumeric',
        }),
        columnHelper.accessor('priority', {
          header: 'Priorität',
          size: 100,
          cell: (info) => <PriorityBadge priority={info.getValue()} />,
          sortingFn: (rowA, rowB, columnId) => {
            const a = rowA.getValue<TaskPriority>(columnId);
            const b = rowB.getValue<TaskPriority>(columnId);
            return PRIORITY_RANK[a] - PRIORITY_RANK[b];
          },
        }),
        columnHelper.accessor('due_date', {
          header: 'Fälligkeit',
          size: 120,
          cell: ({ row, getValue }) => {
            const dueDate = getValue();
            const overdue = isOverdue(dueDate, row.original.status);
            return (
              <span
                className={cn(
                  'tabular-nums text-text-secondary',
                  overdue && 'font-medium text-danger',
                )}
              >
                {formatDate(dueDate)}
              </span>
            );
          },
          sortingFn: (rowA, rowB, columnId) => {
            const a = rowA.getValue<string | null>(columnId);
            const b = rowB.getValue<string | null>(columnId);
            if (a === b) return 0;
            if (!a) return 1;
            if (!b) return -1;
            return a.localeCompare(b);
          },
        }),
        columnHelper.display({
          id: 'entity',
          header: 'Verknüpfung',
          size: 150,
          cell: ({ row }) => <EntityLink task={row.original} className="w-full" />,
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            taskLinkType(rowA.original).localeCompare(taskLinkType(rowB.original)),
        }),
        columnHelper.accessor('status', {
          header: 'Status',
          size: 110,
          cell: (info) => <StatusBadge status={info.getValue()} />,
        }),
      ] as ColumnDef<TaskListItem, unknown>[],
    [handleToggleDone, onOpenTask],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalMinWidth = useMemo(() => computeTotalMinWidth(columns), [columns]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiFilterDropdown
            label="Status"
            count={statusFilters.length}
            items={Object.entries(STATUS_LABELS).map(([value, label]) => ({
              value: value as TaskStatus,
              label,
            }))}
            values={statusFilters}
            onChange={setStatusFilters}
          />
          <MultiFilterDropdown
            label="Priorität"
            count={priorityFilters.length}
            items={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
              value: value as TaskPriority,
              label,
            }))}
            values={priorityFilters}
            onChange={setPriorityFilters}
          />
          <MultiFilterDropdown
            label="Verknüpfung"
            count={linkFilters.length}
            items={Object.entries(LINK_LABELS).map(([value, label]) => ({
              value: value as LinkType,
              label,
            }))}
            values={linkFilters}
            onChange={setLinkFilters}
          />
          <Button
            type="button"
            variant={overdueOnly ? 'secondary' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setOverdueOnly((value) => !value)}
          >
            <CalendarClock className="size-4" />
            Überfällig
          </Button>
          <Button
            type="button"
            variant={recurringOnly ? 'secondary' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setRecurringOnly((value) => !value)}
          >
            <RotateCcw className="size-4" />
            Wiederkehrend
          </Button>
          <label className="ml-auto flex items-center gap-2 rounded-lg border border-border-subtle px-2.5 py-1.5 text-sm text-text-secondary">
            <Checkbox
              checked={showDone}
              onCheckedChange={(checked) => setShowDone(Boolean(checked))}
            />
            Erledigte anzeigen
          </label>
        </div>

        {activeFilterCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {statusFilters.map((status) => (
              <FilterBadge
                key={status}
                label={`Status: ${STATUS_LABELS[status]}`}
                onRemove={() =>
                  setStatusFilters((values) => values.filter((value) => value !== status))
                }
              />
            ))}
            {priorityFilters.map((priority) => (
              <FilterBadge
                key={priority}
                label={`Priorität: ${PRIORITY_LABELS[priority]}`}
                onRemove={() =>
                  setPriorityFilters((values) => values.filter((value) => value !== priority))
                }
              />
            ))}
            {linkFilters.map((linkType) => (
              <FilterBadge
                key={linkType}
                label={`Verknüpfung: ${LINK_LABELS[linkType]}`}
                onRemove={() =>
                  setLinkFilters((values) => values.filter((value) => value !== linkType))
                }
              />
            ))}
            {overdueOnly ? (
              <FilterBadge label="Überfällig" onRemove={() => setOverdueOnly(false)} />
            ) : null}
            {recurringOnly ? (
              <FilterBadge label="Wiederkehrend" onRemove={() => setRecurringOnly(false)} />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={clearFilters}
            >
              <FilterX className="size-4" />
              Filter zurücksetzen
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated dark:border-transparent dark:shadow-md">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-text-muted">
            Aufgaben werden geladen...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-text-muted">
            <p className="text-sm">Keine Aufgaben gefunden</p>
            <p className="text-xs">Passe deine Filter an oder füge eine neue Aufgabe hinzu.</p>
          </div>
        ) : (
          <div ref={parentRef} className="flex-1 overflow-auto">
            <div style={{ minWidth: totalMinWidth }} className="flex flex-col">
              <div className="sticky top-0 z-10 flex border-b border-border-subtle bg-bg-secondary">
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <div
                      key={header.id}
                      className={cn(
                        'group flex h-9 items-center gap-1 px-3 text-xs font-medium text-text-secondary transition-colors',
                        header.column.getCanSort() &&
                          'cursor-pointer select-none hover:text-text-primary',
                      )}
                      style={colStyle(header.column.columnDef.size)}
                      onClick={
                        header.column.getCanSort()
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() ? (
                        <SortIcon sorted={header.column.getIsSorted()} />
                      ) : null}
                    </div>
                  )),
                )}
              </div>

              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const done = row.original.status === 'done';

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'absolute left-0 top-0 flex w-full items-center border-b border-border-subtle transition-colors hover:bg-bg-hover',
                        done && 'opacity-50',
                      )}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        minWidth: '100%',
                      }}
                      onClick={() => onOpenTask(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          className="flex h-full min-w-0 items-center px-3 text-sm"
                          style={colStyle(cell.column.columnDef.size)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MultiFilterDropdownProps<T extends string> {
  label: string;
  count: number;
  items: Array<{ value: T; label: string }>;
  values: T[];
  onChange: (values: T[]) => void;
}

function MultiFilterDropdown<T extends string>({
  label,
  count,
  items,
  values,
  onChange,
}: MultiFilterDropdownProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={count > 0 ? 'secondary' : 'outline'}
            size="sm"
            className="gap-1.5"
          />
        }
      >
        {label}
        {count > 0 ? (
          <Badge variant="outline" className="ml-0.5 h-5 px-1.5">
            {count}
          </Badge>
        ) : null}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={values.includes(item.value)}
              onCheckedChange={(checked) =>
                onChange(toggleFilterValue(values, item.value, Boolean(checked)))
              }
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-pg-accent/40 bg-pg-accent-subtle text-text-primary"
    >
      {label}
      <button
        type="button"
        className="rounded-full text-text-muted hover:text-text-primary"
        aria-label={`${label} entfernen`}
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}
