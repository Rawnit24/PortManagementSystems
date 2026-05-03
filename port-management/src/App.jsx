import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { 
  getPositionKey, 
  validatePlacement, 
  SECTIONS, 
  ROWS, 
  COLS,
  calculateFootprint,
  isBlocked
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
  const [containers, setContainers] = useState([]);
  
  const [currentPlacementContainer, setCurrentPlacementContainer] = useState(null);
  const [currentPlacementOrientation, setCurrentPlacementOrientation] = useState('horizontal');
  const [selectedStack, setSelectedStack] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('3d');

  const [draggedContainerId, setDraggedContainerId] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);

  useEffect(() => {
    setContainers(Object.values(containerMap));
  }, [containerMap]);

  const addContainer = useCallback((data) => {
    const id = `C-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Calculate footprint based on location in data (if manual) or current placement
    const section = data.section || 'A';
    const row = parseInt(data.row || 0);
    const col = parseInt(data.col || 0);
    const orientation = data.orientation || 'horizontal';

    const validation = validatePlacement(yard, containerMap, section, data.size, row, col, orientation);
    if (!validation.valid) {
      alert(validation.reason);
      return null;
    }

    const newContainer = {
      ...data,
      id,
      section,
      row,
      col,
      orientation,
      level: validation.level,
      footprint: validation.footprint
    };

    setContainerMap(prev => ({ ...prev, [id]: newContainer }));
    setYard(prev => {
      const newYard = { ...prev };
      newContainer.footprint.forEach(f => {
        if (!newYard[f.key]) newYard[f.key] = [];
        newYard[f.key].push(id);
      });
      return newYard;
    });

    return id;
  }, [yard, containerMap]);

  const handleDragStart = (e, key, id) => {
    if (!id || isBlocked(yard, containerMap, id)) return;
    setDraggedContainerId(id);
    // e.target.classList.add('dragging');
  };

  const handleDragEnter = (key) => {
    const [section, row, col] = key.split('-');
    const r = parseInt(row);
    const c = parseInt(col);

    if (draggedContainerId) {
      const container = containerMap[draggedContainerId];
      const validation = validatePlacement(yard, containerMap, section, container.size, r, c, container.orientation);
      setDragPreview({
        footprint: validation.footprint || [],
        valid: validation.valid
      });
    } else if (currentPlacementContainer) {
      const validation = validatePlacement(yard, containerMap, section, currentPlacementContainer.size, r, c, currentPlacementOrientation);
      setDragPreview({ // Using same state for simplicity, or can split
        footprint: validation.footprint || [],
        valid: validation.valid
      });
    }
  };

  const handleDrop = (key) => {
    if (!draggedContainerId) return;
    const [section, row, col] = key.split('-');
    
    const container = containerMap[draggedContainerId];
    const validation = validatePlacement(yard, containerMap, section, container.size, parseInt(row), parseInt(col), container.orientation);
    
    if (validation.valid) {
      // Remove old
      setYard(prev => {
        const next = { ...prev };
        container.footprint.forEach(f => {
          next[f.key] = next[f.key].filter(id => id !== draggedContainerId);
        });
        // Add new
        validation.footprint.forEach(f => {
          if (!next[f.key]) next[f.key] = [];
          next[f.key].push(draggedContainerId);
        });
        return next;
      });

      setContainerMap(prev => ({
        ...prev,
        [draggedContainerId]: {
          ...container,
          section,
          row: parseInt(row),
          col: parseInt(col),
          level: validation.level,
          footprint: validation.footprint
        }
      }));
    }

    setDraggedContainerId(null);
    setDragPreview(null);
  };

  const handleCellClick = (key) => {
    if (currentPlacementContainer) {
      const [section, row, col] = key.split('-');
      const id = addContainer({
        ...currentPlacementContainer,
        section,
        row,
        col,
        orientation: currentPlacementOrientation
      });
      if (id) setCurrentPlacementContainer(null);
    } else {
      setSelectedStack({ key });
    }
  };

  const runStressTest = useCallback(() => {
    const types = ['Dry', 'Reefer', 'Hazardous', 'Tank', 'Open Top', 'Flat Rack'];
    const sizes = ['20ft', '40ft'];
    const sections = ['A', 'B', 'C'];
    
    let currentYard = { ...yard };
    let currentMap = { ...containerMap };
    let placedCount = 0;

    for (let i = 0; i < 25; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

      let placed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const section = sections[Math.floor(Math.random() * sections.length)];
        const row = Math.floor(Math.random() * ROWS);
        const col = Math.floor(Math.random() * COLS);

        const validation = validatePlacement(currentYard, currentMap, section, size, row, col, orientation);
        if (validation.valid) {
          const id = `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          const newContainer = {
            id,
            name: `STRESS-${id}`,
            type,
            size,
            weight: Math.floor(Math.random() * 20000) + 5000,
            destination: 'Stress Hub',
            arrival: new Date().toISOString().split('T')[0],
            departure: '',
            section,
            row,
            col,
            orientation,
            level: validation.level,
            footprint: validation.footprint
          };

          currentMap[id] = newContainer;
          validation.footprint.forEach(f => {
            if (!currentYard[f.key]) currentYard[f.key] = [];
            currentYard[f.key].push(id);
          });

          placed = true;
          placedCount++;
          break;
        }
      }
    }

    setYard(currentYard);
    setContainerMap(currentMap);
    alert(`Stress Test Complete! Placed ${placedCount} containers.`);
  }, [yard, containerMap]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'r') {
        setCurrentPlacementOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
      }
      if (e.key === 'Escape') {
        setCurrentPlacementContainer(null);
        setSelectedStack(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`app-container ${selectedStack || isModalOpen ? 'panel-open' : ''}`}>
      <header className="site-header">
        <h1>Container Yard Simulator</h1>
        <p className="subtitle">Port Yard Management Interface</p>
      </header>

      <nav className="tabs-nav">
        <button className={`tab-btn ${activeTab === 'containers' ? 'active' : ''}`} onClick={() => setActiveTab('containers')}>
          Containers
        </button>
        <button className={`tab-btn ${activeTab === 'shipyard' ? 'active' : ''}`} onClick={() => setActiveTab('shipyard')}>
          Shipyard (3D View)
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'containers' && (
          <div className="tab-pane active">
            <div className="containers-header">
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={runStressTest}>Stress Test</button>
                <button className="btn btn-primary" onClick={() => { setModalMode('manual'); setIsModalOpen(true); }}>
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
                selection={selectedStack ? containerMap[yard[selectedStack.key]?.slice(-1)[0]] : null}
              />

              <div className="shipyard-main">
                <div className="three-view-wrapper">
                  <ThreeView yard={yard} containerMap={containerMap} />
                  {currentPlacementContainer && (
                    <div className="placement-banner" style={{position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-glass-heavy)', padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'var(--border-glass)', zIndex: 100}}>
                      Placing: {currentPlacementContainer.type} | R to Rotate | ESC to Cancel
                    </div>
                  )}
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
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <InspectionPanel 
        isOpen={!!selectedStack} 
        stack={selectedStack ? yard[selectedStack.key] : []}
        containerMap={containerMap}
        onClose={() => setSelectedStack(null)}
      />

      <CreateModal 
        isOpen={isModalOpen}
        mode={modalMode}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(data) => {
          if (modalMode === 'manual') {
            addContainer(data);
          } else {
            setCurrentPlacementContainer(data);
          }
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default App;
