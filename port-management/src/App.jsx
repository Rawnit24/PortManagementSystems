import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import {
  validatePlacement,
  calculatePriority,
  isBlocked,
  recalculateAllLevels,
  SECTIONS
} from './utils/yardLogic';

import Sidebar from './components/Sidebar';
import YardGrid from './components/YardGrid';
import ThreeView from './components/ThreeView';
import ContainerRoster from './components/ContainerRoster';
import CreateModal from './components/CreateModal';
import InspectionPanel from './components/InspectionPanel';

function App() {
  const [activeTab, setActiveTab] = useState('containers');
  const [yard, setYard] = useState({});
  const [containerMap, setContainerMap] = useState({});

  const [currentPlacementContainer, setCurrentPlacementContainer] = useState(null);
  const [currentPlacementOrientation, setCurrentPlacementOrientation] = useState('horizontal');

  const [selectedStack, setSelectedStack] = useState(null); // { key, section, row, col }
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('3d');

  // draggedContainerId: the ID being dragged (for source-cell visual + preview). Only set after threshold.
  const [draggedContainerId, setDraggedContainerId] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const counterRef = useRef(0);
  // Internal drag state — never causes re-renders on its own
  const dragStateRef = useRef({ containerId: null, isActive: false });

  // Apply/remove panel-open class on body for backdrop overlay
  useEffect(() => {
    if (selectedStack || isModalOpen) {
      document.body.classList.add('panel-open');
    } else {
      document.body.classList.remove('panel-open');
    }
    return () => document.body.classList.remove('panel-open');
  }, [selectedStack, isModalOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'r' && currentPlacementContainer) {
        setCurrentPlacementOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
      }
      if (e.key === 'Escape') {
        setCurrentPlacementContainer(null);
        setSelectedStack(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPlacementContainer]);

  const handleModalSubmit = useCallback((formData) => {
    counterRef.current += 1;
    const id = `C${counterRef.current}`;
    const priority = calculatePriority(formData.departure);

    const containerBase = {
      id,
      name: formData.name,
      type: formData.type,
      size: formData.size,
      weight: parseInt(formData.weight) || 0,
      destination: formData.destination,
      arrivalDate: formData.arrival,
      departureDate: formData.departure,
      priority,
    };

    if (modalMode === 'manual') {
      const section = formData.section;
      const row = parseInt(formData.row) || 0;
      const col = parseInt(formData.col) || 0;
      const orientation = formData.orientation;

      const validation = validatePlacement(yard, containerMap, section, formData.size, row, col, orientation);
      if (!validation.valid) {
        alert(validation.reason);
        counterRef.current -= 1;
        return;
      }

      const container = {
        ...containerBase,
        section,
        row,
        col,
        origin: { row, col },
        level: validation.level,
        location: `Sec ${section}, Row ${row}, Col ${col}`,
        orientation,
        footprint: validation.footprint
      };

      const newYard = { ...yard };
      validation.footprint.forEach(f => {
        if (!newYard[f.key]) newYard[f.key] = [];
        newYard[f.key].push(id);
      });

      setYard(newYard);
      setContainerMap(prev => ({ ...prev, [id]: container }));
    } else {
      // 3D placement mode — stage the container for click-to-place
      setCurrentPlacementContainer({ ...containerBase, orientation: formData.orientation });
      setCurrentPlacementOrientation(formData.orientation);
    }

    setIsModalOpen(false);
  }, [modalMode, yard, containerMap]);

  // Called from YardGrid cell click or ThreeView ground click during placement
  const handlePlacement = useCallback((section, row, col) => {
    if (!currentPlacementContainer) return;

    const validation = validatePlacement(yard, containerMap, section, currentPlacementContainer.size, row, col, currentPlacementOrientation);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    const container = {
      ...currentPlacementContainer,
      section,
      row: parseInt(row),
      col: parseInt(col),
      origin: { row: parseInt(row), col: parseInt(col) },
      level: validation.level,
      location: `Sec ${section}, Row ${row}, Col ${col}`,
      orientation: currentPlacementOrientation,
      footprint: validation.footprint
    };

    const newYard = { ...yard };
    validation.footprint.forEach(f => {
      if (!newYard[f.key]) newYard[f.key] = [];
      newYard[f.key].push(container.id);
    });

    setYard(newYard);
    setContainerMap(prev => ({ ...prev, [container.id]: container }));
    setCurrentPlacementContainer(null);
  }, [yard, containerMap, currentPlacementContainer, currentPlacementOrientation]);

  const handleCellClick = useCallback((key) => {
    if (currentPlacementContainer) {
      const parts = key.split('_');
      handlePlacement(parts[0], parseInt(parts[1]), parseInt(parts[2]));
      return;
    }

    const stack = yard[key];
    if (stack && stack.length > 0) {
      const parts = key.split('_');
      setSelectedStack({ key, section: parts[0], row: parseInt(parts[1]), col: parseInt(parts[2]) });
    } else {
      setSelectedStack(null);
    }
  }, [currentPlacementContainer, yard, handlePlacement]);

  const handleContainerClickIn3D = useCallback(({ key, section, row, col }) => {
    const stack = yard[key];
    if (stack && stack.length > 0) {
      setSelectedStack({ key, section, row, col });
    }
  }, [yard]);

  const moveContainerAction = useCallback((containerId, destSection, destRow, destCol) => {
    const container = containerMap[containerId];
    if (!container) return;

    if (isBlocked(yard, containerMap, containerId)) {
      alert('Container is blocked. Use Retrieval Plan to move blocking containers first.');
      return;
    }

    // Remove from source first so validation sees the yard without the container
    const newYard = { ...yard };
    container.footprint.forEach(f => {
      if (newYard[f.key]) {
        newYard[f.key] = newYard[f.key].filter(id => id !== containerId);
        if (newYard[f.key].length === 0) delete newYard[f.key];
      }
    });

    const validation = validatePlacement(newYard, containerMap, destSection, container.size, parseInt(destRow), parseInt(destCol), container.orientation);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    validation.footprint.forEach(f => {
      if (!newYard[f.key]) newYard[f.key] = [];
      newYard[f.key].push(containerId);
    });

    const updatedContainer = {
      ...container,
      section: destSection,
      row: parseInt(destRow),
      col: parseInt(destCol),
      origin: { row: parseInt(destRow), col: parseInt(destCol) },
      level: validation.level,
      location: `Sec ${destSection}, Row ${destRow}, Col ${destCol}`,
      footprint: validation.footprint
    };

    const newMap = { ...containerMap, [containerId]: updatedContainer };
    const recalcMap = recalculateAllLevels(newYard, newMap);

    setYard(newYard);
    setContainerMap(recalcMap);
    setSelectedStack(null);
  }, [yard, containerMap]);

  const removeContainerAction = useCallback((containerId, isShipped = false) => {
    const container = containerMap[containerId];
    if (!container) return;

    if (isBlocked(yard, containerMap, containerId)) {
      alert('Container is blocked. Use Retrieval Plan to move blocking containers first.');
      return;
    }

    if (!confirm(`Are you sure you want to ${isShipped ? 'move out' : 'remove'} this container?`)) return;

    const newYard = { ...yard };
    container.footprint.forEach(f => {
      if (newYard[f.key]) {
        newYard[f.key] = newYard[f.key].filter(id => id !== containerId);
        if (newYard[f.key].length === 0) delete newYard[f.key];
      }
    });

    const newMap = { ...containerMap };
    delete newMap[containerId];

    const recalcMap = recalculateAllLevels(newYard, newMap);

    setYard(newYard);
    setContainerMap(recalcMap);
    setSelectedStack(null);
  }, [yard, containerMap]);

  // Drag handlers — ref-based to avoid stale closures and unwanted re-renders

  // Stable cleanup that's always current because it only touches refs and setters
  const cleanupDrag = useCallback(() => {
    dragStateRef.current = { containerId: null, isActive: false };
    setDraggedContainerId(null);
    setDragPreview(null);
    document.body.style.cursor = '';
  }, []);

  const handleDragStart = useCallback((e, _key, id) => {
    if (!id || isBlocked(yard, containerMap, id)) return;

    const startX = e.clientX;
    const startY = e.clientY;
    dragStateRef.current = { containerId: id, isActive: false };

    const onMouseMove = (moveEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!dragStateRef.current.isActive && dist > 5) {
        dragStateRef.current.isActive = true;
        setDraggedContainerId(id);
        document.body.style.cursor = 'grabbing';
      }
      if (dragStateRef.current.isActive) {
        setMousePos({ x: moveEvent.clientX, y: moveEvent.clientY });
      }
    };

    const onMouseUp = () => {
      cleanupDrag();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [yard, containerMap, cleanupDrag]);

  const handleDragEnter = useCallback((key) => {
    if (!dragStateRef.current.isActive || !dragStateRef.current.containerId) return;
    const parts = key.split('_');
    const container = containerMap[dragStateRef.current.containerId];
    if (!container) return;
    const validation = validatePlacement(yard, containerMap, parts[0], container.size, parseInt(parts[1]), parseInt(parts[2]), container.orientation);
    setDragPreview({ footprint: validation.footprint || [], valid: validation.valid });
  }, [containerMap, yard]);

  const handleDrop = useCallback((key) => {
    if (!dragStateRef.current.isActive || !dragStateRef.current.containerId) return;
    const parts = key.split('_');
    const containerId = dragStateRef.current.containerId;
    const container = containerMap[containerId];
    if (!container) return;
    const validation = validatePlacement(yard, containerMap, parts[0], container.size, parseInt(parts[1]), parseInt(parts[2]), container.orientation);
    if (validation.valid) {
      moveContainerAction(containerId, parts[0], parseInt(parts[1]), parseInt(parts[2]));
    }
    // Global mouseup listener handles cleanup
  }, [containerMap, yard, moveContainerAction]);

  const runStressTest = useCallback(() => {
    counterRef.current = 0;

    const types = ['Dry', 'Reefer', 'Hazardous', 'Tank', 'Open Top', 'Flat Rack'];
    const sizes = ['20ft', '40ft'];
    const sections = ['A', 'B', 'C'];

    const newYard = {};
    const newMap = {};
    let placedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < 25; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

      let placed = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const section = sections[Math.floor(Math.random() * sections.length)];
        const row = Math.floor(Math.random() * 10);
        const col = Math.floor(Math.random() * 10);

        const validation = validatePlacement(newYard, newMap, section, size, row, col, orientation);
        if (validation.valid) {
          counterRef.current += 1;
          const id = `C${counterRef.current}`;
          const container = {
            id,
            name: `AUTO-${id}`,
            type,
            size,
            weight: Math.floor(Math.random() * 20000) + 5000,
            destination: 'Stress Test Hub',
            arrivalDate: new Date().toISOString().split('T')[0],
            departureDate: '',
            priority: 'low',
            location: `Sec ${section}, Row ${row}, Col ${col}`,
            section,
            row,
            col,
            origin: { row, col },
            level: validation.level,
            orientation,
            footprint: validation.footprint
          };

          newMap[id] = container;
          validation.footprint.forEach(f => {
            if (!newYard[f.key]) newYard[f.key] = [];
            newYard[f.key].push(id);
          });

          placed = true;
          placedCount++;
          break;
        }
      }
      if (!placed) failedCount++;
    }

    setYard(newYard);
    setContainerMap(newMap);
    setSelectedStack(null);
    setCurrentPlacementContainer(null);
    alert(`Stress Test Complete!\nPlaced: ${placedCount}\nFailed: ${failedCount}`);
  }, []);

  const containers = Object.values(containerMap);

  return (
    <div className="app-container">
      <header className="site-header">
        <h1>Container Yard Simulator</h1>
        <p className="subtitle">Port Yard Management Interface</p>
      </header>

      {currentPlacementContainer && (
        <div className="placement-banner">
          <div className="banner-content">
            <span>
              Placing: {currentPlacementContainer.type} &nbsp;|&nbsp;
              Orientation: {currentPlacementOrientation.charAt(0).toUpperCase() + currentPlacementOrientation.slice(1)} &nbsp;|&nbsp;
              Press <kbd>R</kbd> to Rotate &nbsp;|&nbsp; <kbd>ESC</kbd> to Cancel
            </span>
          </div>
        </div>
      )}

      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'containers' ? 'active' : ''}`}
          onClick={() => setActiveTab('containers')}
        >
          Containers
        </button>
        <button
          className={`tab-btn ${activeTab === 'shipyard' ? 'active' : ''}`}
          onClick={() => setActiveTab('shipyard')}
        >
          Shipyard (3D View)
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'containers' && (
          <div className="tab-pane active">
            <div className="containers-header">
              <div className="header-actions">
                {currentPlacementContainer && (
                  <span className="container-status">
                    Ready to place {currentPlacementContainer.id}
                  </span>
                )}
                <button className="btn btn-secondary" onClick={runStressTest}>Stress Test</button>
                <button
                  className="btn btn-primary"
                  onClick={() => { setModalMode('manual'); setIsModalOpen(true); }}
                >
                  Create Manual
                </button>
              </div>
            </div>
            <ContainerRoster containers={containers} yard={yard} />
          </div>
        )}

        {activeTab === 'shipyard' && (
          <div className="tab-pane active">
            <div className="shipyard-wrapper">
              <Sidebar
                onOpenModal={() => { setModalMode('3d'); setIsModalOpen(true); }}
                placementMode={!!currentPlacementContainer}
                placementOrientation={currentPlacementOrientation}
                selection={selectedStack ? containerMap[yard[selectedStack.key]?.slice(-1)[0]] : null}
              />

              <div className="shipyard-main">
                <div className="three-view-wrapper">
                  <ThreeView
                    yard={yard}
                    containerMap={containerMap}
                    currentPlacementContainer={currentPlacementContainer}
                    currentPlacementOrientation={currentPlacementOrientation}
                    onPlaceContainer={handlePlacement}
                    onContainerClick={handleContainerClickIn3D}
                  />
                </div>

                <div className="yard-layout">
                  {SECTIONS.map(s => (
                    <YardGrid
                      key={s}
                      section={s}
                      yard={yard}
                      containerMap={containerMap}
                      onCellClick={handleCellClick}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDrop={handleDrop}
                      dragPreview={dragPreview}
                      draggedContainerId={draggedContainerId}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <p>Container Yard Simulator &mdash; Phase 1</p>
      </footer>

      <InspectionPanel
        isOpen={!!selectedStack}
        stackKey={selectedStack?.key}
        stackInfo={selectedStack}
        yard={yard}
        containerMap={containerMap}
        onClose={() => setSelectedStack(null)}
        onMoveContainer={moveContainerAction}
        onRemoveContainer={(id) => removeContainerAction(id, false)}
        onShipContainer={(id) => removeContainerAction(id, true)}
      />

      <CreateModal
        isOpen={isModalOpen}
        mode={modalMode}
        yard={yard}
        containerMap={containerMap}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      {/* Floating Drag Ghost */}
      {draggedContainerId && (
        <div 
          className="drag-ghost"
          style={{
            position: 'fixed',
            left: mousePos.x,
            top: mousePos.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 3000,
            width: containerMap[draggedContainerId]?.size === '20ft' ? '60px' : '100px',
            height: '40px',
            background: containerMap[draggedContainerId]?.type === 'Hazardous' ? 'var(--ef4444, #ef4444)' : 'var(--accent-primary)',
            borderRadius: '6px',
            opacity: 0.9,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: '900',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            backdropFilter: 'blur(8px)',
            transition: 'transform 0.1s ease-out'
          }}
        >
          {draggedContainerId}
        </div>
      )}
    </div>
  );
}

export default App;
