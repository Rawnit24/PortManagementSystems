import { useState, useEffect } from 'react';
import { CONTAINER_TYPES, SIZES, SECTIONS, validatePlacement, MAX_STACK_HEIGHT } from '../utils/yardLogic';

export default function CreateModal({ isOpen, mode, yard, containerMap, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Dry',
    size: '20ft',
    weight: '',
    destination: '',
    arrival: '',
    departure: '',
    orientation: 'horizontal',
    section: 'A',
    row: '0',
    col: '0'
  });
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
    if (isOpen && mode === '3d') {
      calcSuggestion(formData.size, formData.orientation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, formData.size, formData.orientation]);

  function calcSuggestion(size, orientation) {
    let bestRow = 0, bestCol = 0, minHeight = 999, bestSection = 'A';
    for (const section of SECTIONS) {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          const v = validatePlacement(yard, containerMap, section, size, r, c, orientation);
          if (v.valid) {
            const h = yard[v.footprint[0].key] ? yard[v.footprint[0].key].length : 0;
            if (h < minHeight) { minHeight = h; bestRow = r; bestCol = c; bestSection = section; }
          }
        }
      }
    }
    if (minHeight < MAX_STACK_HEIGHT) {
      setSuggestion(`Suggested: Sec ${bestSection}, Row ${bestRow}, Col ${bestCol} (Level ${minHeight})`);
    } else {
      setSuggestion('Yard is completely full!');
    }
  }

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { id, value } = e.target;
    const field = id.replace('field-', '');
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Create Container</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="field-name">Container Name</label>
            <input type="text" id="field-name" value={formData.name} onChange={handleChange} placeholder="e.g. MSCU-8042" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="field-type">Type</label>
              <select id="field-type" value={formData.type} onChange={handleChange} required>
                {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="field-size">Size</label>
              <select id="field-size" value={formData.size} onChange={handleChange} required>
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="field-orientation">Orientation (40/45ft)</label>
              <select id="field-orientation" value={formData.orientation} onChange={handleChange}>
                <option value="horizontal">Horizontal (Col-span)</option>
                <option value="vertical">Vertical (Row-span)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="field-weight">Weight (kg)</label>
            <input type="number" id="field-weight" value={formData.weight} onChange={handleChange} placeholder="e.g. 18000" min="1" required />
          </div>

          <div className="form-group">
            <label htmlFor="field-destination">Destination</label>
            <input type="text" id="field-destination" value={formData.destination} onChange={handleChange} placeholder="e.g. Rotterdam" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="field-arrival">Arrival Date</label>
              <input type="date" id="field-arrival" value={formData.arrival} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="field-departure">Departure Date</label>
              <input type="date" id="field-departure" value={formData.departure} onChange={handleChange} required />
            </div>
          </div>

          {mode === 'manual' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="field-section">Section</label>
                <select id="field-section" value={formData.section} onChange={handleChange}>
                  {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="field-row">Row (0-9)</label>
                <input type="number" id="field-row" min="0" max="9" value={formData.row} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="field-col">Col (0-9)</label>
                <input type="number" id="field-col" min="0" max="9" value={formData.col} onChange={handleChange} />
              </div>
            </div>
          )}

          {mode === '3d' && (
            <div className="suggestion-box">
              <strong>💡 Tip:</strong>{' '}
              <span>{suggestion || 'Enter container details then click on the yard grid to place.'}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '20px' }}>
            {mode === 'manual' ? 'Create Container' : 'Start Placement'}
          </button>
        </form>
      </div>
    </div>
  );
}
