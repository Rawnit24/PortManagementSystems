import React from 'react';

const InspectionPanel = ({ isOpen, stack, containerMap, onClose, onMove }) => {
  return (
    <aside className={`inspection-panel ${isOpen ? 'active' : ''}`}>
      <div className="panel-header">
        <h3 id="panel-title">Stack Details</h3>
        <button className="panel-close" onClick={onClose}>&times;</button>
      </div>
      <div className="panel-content">
        {stack && stack.map((id, index) => {
          const c = containerMap[id];
          return (
            <div key={id} className="container-card">
              <div className="card-header">
                <span className="card-id">{c.id}</span>
                <span className="card-level">Lvl {index}</span>
              </div>
              <div className="card-row"><span className="card-label">Type</span><span className="card-value">{c.type}</span></div>
              <div className="card-row"><span className="card-label">Size</span><span className="card-value">{c.size}</span></div>
              <div className="card-row"><span className="card-label">Weight</span><span className="card-value">{c.weight} kg</span></div>
              {index === stack.length - 1 && (
                <div style={{marginTop: '12px', display: 'flex', gap: '8px'}}>
                   {/* Simplified action buttons */}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default InspectionPanel;
