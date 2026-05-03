import React from 'react';
import { getPositionKey } from '../utils/yardLogic';

const GridCell = ({ 
  section, 
  row, 
  col, 
  stack, 
  containerMap, 
  onClick, 
  onDragStart, 
  onDragEnter, 
  onDrop,
  dragPreview,
  placementPreview // New prop
}) => {
  const key = getPositionKey(section, row, col);
  const topContainerId = stack && stack.length > 0 ? stack[stack.length - 1] : null;
  const topContainer = topContainerId ? containerMap[topContainerId] : null;

  const isDragValid = dragPreview && dragPreview.footprint.some(f => f.key === key) && dragPreview.valid;
  const isDragInvalid = dragPreview && dragPreview.footprint.some(f => f.key === key) && !dragPreview.valid;
  
  const isPlaceValid = placementPreview && placementPreview.footprint.some(f => f.key === key) && placementPreview.valid;
  const isPlaceInvalid = placementPreview && placementPreview.footprint.some(f => f.key === key) && !placementPreview.valid;

  const isValid = isDragValid || isPlaceValid;
  const isInvalid = isDragInvalid || isPlaceInvalid;

  return (
    <div 
      className={`grid-cell ${topContainer ? 'occupied' : ''} ${isValid ? 'preview-valid' : ''} ${isInvalid ? 'preview-invalid' : ''}`}
      onClick={() => onClick(key)}
      onMouseDown={(e) => onDragStart && onDragStart(e, key, topContainerId)}
      onMouseEnter={() => onDragEnter && onDragEnter(key)}
      onMouseUp={() => onDrop && onDrop(key)}
    >
      {topContainer && (
        <span className="container-id-label">{topContainer.id}</span>
      )}
      {stack && stack.length > 0 && (
        <div className="stack-indicator">
          {stack.map((_, i) => <div key={i} className="stack-bar" />)}
        </div>
      )}
    </div>
  );
};

const YardGrid = ({ section, yard, containerMap, onCellClick, ...dragHandlers }) => {
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
          {...dragHandlers}
        />
      );
    }
  }

  return (
    <section className={`yard-section section-${section.toLowerCase()}`}>
      <h2 className="section-title">Section {section}</h2>
      <div className="grid-container">
        {cells}
      </div>
    </section>
  );
};

export default YardGrid;
