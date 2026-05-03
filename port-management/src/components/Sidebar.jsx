import React from 'react';

const Sidebar = ({ onOpenModal, placementMode, selection, modeText = 'Normal View' }) => {
  return (
    <aside className="shipyard-sidebar">
      <div className="sidebar-widget">
        <button className="btn btn-primary btn-full" onClick={onOpenModal}>
          + Create (3D Placement)
        </button>
      </div>

      <div className="sidebar-widget">
        <h4 className="widget-title">Current Mode</h4>
        <div className={`status-indicator ${placementMode ? 'status-active' : ''}`}>
          <span className="status-dot"></span>
          <span id="mode-text">{placementMode ? 'Placement Mode' : modeText}</span>
        </div>
      </div>

      <div className="sidebar-widget">
        <h4 className="widget-title">Selection Info</h4>
        <div id="selection-info-display" className="selection-info">
          {selection ? (
            <div className="selection-info">
              <div className="info-row"><span className="info-label">ID</span><span className="info-value">{selection.id}</span></div>
              <div className="info-row"><span className="info-label">Type</span><span className="info-value">{selection.type}</span></div>
              <div className="info-row"><span className="info-label">Size</span><span className="info-value">{selection.size}</span></div>
              <div className="info-row"><span className="info-label">Level</span><span className="info-value">{selection.level}</span></div>
              <div className="info-row"><span className="info-label">Weight</span><span className="info-value">{selection.weight} kg</span></div>
            </div>
          ) : (
            <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Click a container to see details.</p>
          )}
        </div>
      </div>

      <div id="widget-tips" className={`sidebar-widget ${!placementMode ? 'hidden' : ''}`}>
        <h4 className="widget-title">Quick Tips</h4>
        <div className="tip-item"><span className="tip-key">R</span> <span>Rotate footprint</span></div>
        <div className="tip-item"><span className="tip-key">ESC</span> <span>Cancel placement</span></div>
        <div className="tip-item"><span className="tip-key">DRAG</span> <span>Move container</span></div>
      </div>
    </aside>
  );
};

export default Sidebar;
