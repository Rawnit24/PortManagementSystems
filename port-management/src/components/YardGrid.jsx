import { useState } from 'react';
import { getPositionKey, SECTION_LABELS } from '../utils/yardLogic';

function GridCell({
  section, row, col, stack, containerMap,
  onClick, onDragStart, onDragEnter, onDrop,
  onCellMouseEnter, onCellMouseLeave,
  dragPreview, footprintHover, isDragSource
}) {
  const key = getPositionKey(section, row, col);
  const topId = stack && stack.length > 0 ? stack[stack.length - 1] : null;
  const topContainer = topId ? containerMap[topId] : null;

  const isPreviewValid = dragPreview?.footprint?.some(f => f.key === key) && dragPreview.valid;
  const isPreviewInvalid = dragPreview?.footprint?.some(f => f.key === key) && !dragPreview.valid;
  const isFootprintHovered = footprintHover?.includes(key);

  let cellClass = 'grid-cell';
  if (topContainer) cellClass += ' occupied';
  if (isDragSource) cellClass += ' dragging';
  if (isPreviewValid) cellClass += ' preview-valid';
  if (isPreviewInvalid) cellClass += ' preview-invalid';
  if (isFootprintHovered && !isDragSource) cellClass += ' footprint-hover';

  return (
    <div
      className={cellClass}
      onClick={() => onClick(key)}
      onMouseDown={(e) => onDragStart?.(e, key, topId)}
      onMouseEnter={() => { onDragEnter?.(key); onCellMouseEnter?.(key); }}
      onMouseUp={() => onDrop?.(key)}
      onMouseLeave={onCellMouseLeave}
    >
      {topContainer && (
        <>
          {(topContainer.origin?.row === row && topContainer.origin?.col === col) && (
            <span className="container-id-label">{topContainer.id}</span>
          )}
          <div className="stack-indicator">
            {stack.map((_, i) => <div key={i} className="stack-bar" />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function YardGrid({
  section, yard, containerMap,
  onCellClick, onDragStart, onDragEnter, onDrop,
  dragPreview, draggedContainerId
}) {
  const [footprintHover, setFootprintHover] = useState(null);

  // Keys belonging to the dragged container's footprint — for source-cell .dragging class
  const dragSourceKeys = draggedContainerId
    ? (containerMap[draggedContainerId]?.footprint?.map(f => f.key) ?? [])
    : [];

  const handleCellMouseEnter = (key) => {
    if (draggedContainerId) return; // suppress footprint hover while dragging
    const stack = yard[key];
    if (!stack || stack.length === 0) { setFootprintHover(null); return; }
    const topId = stack[stack.length - 1];
    const container = containerMap[topId];
    if (container?.footprint) {
      setFootprintHover(container.footprint.map(f => f.key));
    }
  };

  const cells = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const key = getPositionKey(section, r, c);
      cells.push(
        <GridCell
          key={key}
          section={section}
          row={r}
          col={c}
          stack={yard[key]}
          containerMap={containerMap}
          onClick={onCellClick}
          onDragStart={onDragStart}
          onDragEnter={onDragEnter}
          onDrop={onDrop}
          onCellMouseEnter={handleCellMouseEnter}
          onCellMouseLeave={() => !draggedContainerId && setFootprintHover(null)}
          dragPreview={dragPreview}
          footprintHover={footprintHover}
          isDragSource={dragSourceKeys.includes(key)}
        />
      );
    }
  }

  return (
    <section className={`yard-section section-${section.toLowerCase()}`}>
      <h2 className="section-title">Section {section}</h2>
      <p className="section-label">{SECTION_LABELS[section]}</p>
      <div className="grid-container">
        {cells}
      </div>
    </section>
  );
}
