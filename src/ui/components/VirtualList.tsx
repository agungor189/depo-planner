import { ReactNode, useMemo, useState } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  height: number;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
}

export function VirtualList<T>({ items, rowHeight, height, overscan = 6, renderRow }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * rowHeight;
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
    return { start, end };
  }, [height, items.length, overscan, rowHeight, scrollTop]);
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      className="overflow-auto"
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: totalHeight }}>
        <div className="absolute left-0 right-0 top-0" style={{ transform: `translateY(${visibleRange.start * rowHeight}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={visibleRange.start + index} style={{ height: rowHeight }}>
              {renderRow(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
