import { useState } from 'react';
import { MAX_STACK_HEIGHT } from '../utils/yardLogic';

export default function InspectionPanel({
  isOpen,
  stackKey,
  stackInfo,
  yard,
  containerMap,
  onClose,
  onMoveContainer,
  onRemoveContainer,
  onShipContainer
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [moveSection, setMoveSection] = useState('A');
  const [moveRow, setMoveRow] = useState('');
  const [moveCol, setMoveCol] = useState('');

  const stack = (stackKey && yard[stackKey]) ? yard[stackKey] : [];

  const handleCardClick = (index) => {
    setSelectedIndex(prev => prev === index ? null : index);
    setMoveSection('A');
    setMoveRow('');
    setMoveCol('');
  };

  const handleMove = () => {
    if (moveRow === '' || moveCol === '') {
      alert('Please enter destination Row and Column.');
      return;
    }
    const targetId = stack[selectedIndex];
    onMoveContainer(targetId, moveSection, parseInt(moveRow), parseInt(moveCol));
    setSelectedIndex(null);
  };

  const handleRemove = (id) => {
    onRemoveContainer(id);
    setSelectedIndex(null);
  };

  const handleShip = (id) => {
    onShipContainer(id);
    setSelectedIndex(null);
  };

  const getRetrievalSteps = (targetIndex) => {
    const steps = [];
    for (let i = stack.length - 1; i > targetIndex; i--) {
      const c = containerMap[stack[i]];
      if (c) steps.push({ index: i, text: `Move ${c.id} (Level ${c.level}) → Temp Yard` });
    }
    const target = containerMap[stack[targetIndex]];
    if (target) steps.push({ index: targetIndex, text: `Retrieve ${target.id} (Level ${target.level})`, isTarget: true });
    return steps;
  };

  const section = stackInfo?.section ?? '';
  const row = stackInfo?.row ?? '';
  const col = stackInfo?.col ?? '';

  return (
    <aside className={`inspection-panel ${isOpen ? 'active' : ''}`}>
      <div className="panel-header">
        <h3>Stack: Sec {section}, Row {row}, Col {col}</h3>
        <button className="panel-close" onClick={onClose}>&times;</button>
      </div>
      <div className="panel-content">
        {stack.length > 0 && (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>
            Total Containers: {stack.length} / {MAX_STACK_HEIGHT}
          </div>
        )}

        {stack.map((id, index) => {
          const c = containerMap[id];
          if (!c) return null;
          const isSelected = selectedIndex === index;

          return (
            <div key={id}>
              <div
                className={`container-card ${isSelected ? 'card-target' : ''}`}
                onClick={() => handleCardClick(index)}
              >
                <div className="card-header">
                  <span className="card-id">{c.id}</span>
                  <span className="card-level">Lvl {c.level}</span>
                </div>
                <div className="card-row"><span className="card-label">Type</span><span className="card-value">{c.type}</span></div>
                <div className="card-row"><span className="card-label">Size</span><span className="card-value">{c.size}</span></div>
                <div className="card-row"><span className="card-label">Weight</span><span className="card-value">{c.weight} kg</span></div>
                <div className="card-row"><span className="card-label">Priority</span><span className={`priority-badge priority-${c.priority}`}>{c.priority?.toUpperCase()}</span></div>
              </div>

              {isSelected && (
                <div className="retrieval-plan-box">
                  <h4>Retrieval Plan</h4>
                  {getRetrievalSteps(index).map((step, si) => (
                    <div key={si} className={`retrieval-step ${step.isTarget ? 'step-retrieve' : ''}`}>
                      <span>{si + 1}.</span> <span>{step.text}</span>
                    </div>
                  ))}

                  <div className="relocation-form">
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#f1f5f9' }}>Move Container</h4>
                    <div className="relocation-inputs">
                      <select
                        value={moveSection}
                        onChange={e => setMoveSection(e.target.value)}
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                      >
                        <option value="A">Sec A</option>
                        <option value="B">Sec B</option>
                        <option value="C">Sec C</option>
                      </select>
                      <input
                        type="number" min="0" max="9" placeholder="Row"
                        value={moveRow} onChange={e => setMoveRow(e.target.value)}
                      />
                      <input
                        type="number" min="0" max="9" placeholder="Col"
                        value={moveCol} onChange={e => setMoveCol(e.target.value)}
                      />
                    </div>
                    <button className="btn-move" onClick={handleMove}>Move Container</button>
                  </div>

                  <button
                    className="btn-action btn-remove"
                    onClick={() => handleRemove(id)}
                  >
                    Remove Container
                  </button>
                  <button
                    className="btn-action btn-ship"
                    onClick={() => handleShip(id)}
                  >
                    Move Out Container
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {stack.length === 0 && isOpen && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No containers in this stack.</p>
        )}
      </div>
    </aside>
  );
}
