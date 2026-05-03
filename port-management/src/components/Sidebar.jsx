export default function Sidebar({ onOpenModal, placementMode, placementOrientation, selection }) {
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
          <span>{placementMode ? `Placement Mode (${placementOrientation})` : 'Normal View'}</span>
        </div>
      </div>

      <div className="sidebar-widget">
        <h4 className="widget-title">Selection Info</h4>
        <div className="selection-info">
          {selection ? (
            <>
              <div className="info-row"><span className="info-label">ID</span><span className="info-value">{selection.id}</span></div>
              <div className="info-row"><span className="info-label">Type</span><span className="info-value">{selection.type}</span></div>
              <div className="info-row"><span className="info-label">Size</span><span className="info-value">{selection.size}</span></div>
              <div className="info-row"><span className="info-label">Level</span><span className="info-value">{selection.level}</span></div>
              <div className="info-row"><span className="info-label">Weight</span><span className="info-value">{selection.weight} kg</span></div>
            </>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click a container to see details.</p>
          )}
        </div>
      </div>

      {placementMode && (
        <div className="sidebar-widget">
          <h4 className="widget-title">Quick Tips</h4>
          <div className="tip-item"><span className="tip-key">R</span> <span>Rotate footprint</span></div>
          <div className="tip-item"><span className="tip-key">ESC</span> <span>Cancel placement</span></div>
          <div className="tip-item"><span className="tip-key">DRAG</span> <span>Move container</span></div>
        </div>
      )}
    </aside>
  );
}
