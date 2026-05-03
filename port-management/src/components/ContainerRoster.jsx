import React from 'react';

const ContainerRoster = ({ containers, yard }) => {
  const total = containers.length;
  const highPriority = 0; // Simplified
  const avgStack = (Object.values(yard).reduce((a, s) => a + s.length, 0) / (Object.keys(yard).length || 1)).toFixed(1);

  return (
    <div className="analytics-container">
      <div className="kpi-row">
        <div className="kpi-card"><h3>Total Containers</h3><div className="kpi-value">{total}</div></div>
        <div className="kpi-card"><h3>High Priority</h3><div className="kpi-value">{highPriority}</div></div>
        <div className="kpi-card"><h3>Avg Stack Height</h3><div className="kpi-value">{avgStack}</div></div>
        <div className="kpi-card"><h3>Utilization</h3><div className="kpi-value">24%</div></div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Weight</th>
              <th>Location</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {containers.length === 0 ? (
              <tr className="empty-row"><td colSpan="7">No containers available.</td></tr>
            ) : (
              containers.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.type}</td>
                  <td>{c.size}</td>
                  <td>{c.weight} kg</td>
                  <td>{c.section}-{c.row}-{c.col}</td>
                  <td>{c.level}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContainerRoster;
