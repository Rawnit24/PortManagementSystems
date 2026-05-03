import React, { useState } from 'react';
import { CONTAINER_TYPES, SIZES, SECTIONS } from '../utils/yardLogic';

const CreateModal = ({ isOpen, mode, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Dry',
    size: '20ft',
    weight: 18000,
    destination: '',
    arrival: '',
    departure: '',
    orientation: 'horizontal',
    section: 'A',
    row: 0,
    col: 0
  });

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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Create Container</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="field-name">Container Name</label>
            <input type="text" id="field-name" value={formData.name} onChange={handleChange} required />
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
              <label htmlFor="field-orientation">Orientation</label>
              <select id="field-orientation" value={formData.orientation} onChange={handleChange}>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="field-weight">Weight (kg)</label>
            <input type="number" id="field-weight" value={formData.weight} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="field-destination">Destination</label>
            <input type="text" id="field-destination" value={formData.destination} onChange={handleChange} required />
          </div>

          {mode === 'manual' && (
            <div id="manual-coordinates">
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
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" style={{marginTop: '20px'}}>
            {mode === 'manual' ? 'Place Container' : 'Start Placement'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;
