import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const CHART_COLORS = {
  cyan: '#22d3ee',
  purple: '#818cf8',
  amber: '#f59e0b',
};

function makeGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 230);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(0.65, color + '0d');
  gradient.addColorStop(1, color + '00');
  return gradient;
}

function makeChartOptions(color) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(8, 14, 30, 0.95)',
        titleColor: 'rgba(148, 163, 184, 0.6)',
        bodyColor: '#f0f8ff',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
      }
    },
    scales: {
      y: {
        ticks: { color: 'rgba(148,163,184,0.45)', font: { size: 10 }, maxTicksLimit: 5 },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { display: false },
        beginAtZero: true,
      },
      x: {
        ticks: { color: 'rgba(148,163,184,0.55)', font: { size: 10 } },
        grid: { display: false },
        border: { display: false },
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
        backgroundColor: '#050c18',
        borderWidth: 2.5,
        borderColor: color,
        hoverBorderColor: color,
        hoverBackgroundColor: '#050c18',
      }
    }
  };
}

export default function ContainerRoster({ containers, yard }) {
  const sectionChartRef = useRef(null);
  const typeChartRef = useRef(null);
  const stackChartRef = useRef(null);
  const chartsRef = useRef({});

  const total = containers.length;
  const high = containers.filter(c => c.priority === 'high').length;
  const low = containers.filter(c => c.priority === 'low').length;

  const stackValues = Object.values(yard);
  const avgStack = stackValues.length
    ? (stackValues.reduce((a, s) => a + s.length, 0) / stackValues.length).toFixed(1)
    : '0.0';

  const sections = { A: 0, B: 0, C: 0 };
  containers.forEach(c => { if (sections[c.section] !== undefined) sections[c.section]++; });

  const types = {};
  containers.forEach(c => { types[c.type] = (types[c.type] || 0) + 1; });

  const stackLevels = { 0: 0, 1: 0, 2: 0, 3: 0 };
  Object.values(yard).forEach(stack => {
    const l = Math.min(stack.length, 3);
    stackLevels[l] = (stackLevels[l] || 0) + 1;
  });

  const insights = [];
  if (high > 0) insights.push('⚠️ High priority containers need attention');
  if (sections.A > sections.B && sections.A > sections.C) insights.push('📦 Section A is most occupied');
  else if (sections.B > sections.C) insights.push('📦 Section B is most occupied');
  if (stackLevels[3] > 0) insights.push('🚧 Some stacks are at maximum height');
  if (insights.length === 0) insights.push('✅ Yard is operating smoothly');

  useEffect(() => {
    Object.values(chartsRef.current).forEach(c => c && c.destroy());
    chartsRef.current = {};

    if (sectionChartRef.current) {
      const ctx = sectionChartRef.current.getContext('2d');
      chartsRef.current.section = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Section A', 'Section B', 'Section C'],
          datasets: [{
            data: [sections.A, sections.B, sections.C],
            borderColor: CHART_COLORS.cyan,
            backgroundColor: makeGradient(ctx, CHART_COLORS.cyan),
            fill: true,
            borderWidth: 2,
            tension: 0.4,
          }]
        },
        options: makeChartOptions(CHART_COLORS.cyan)
      });
    }
    if (typeChartRef.current) {
      const ctx = typeChartRef.current.getContext('2d');
      chartsRef.current.type = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Object.keys(types),
          datasets: [{
            data: Object.values(types),
            borderColor: CHART_COLORS.purple,
            backgroundColor: makeGradient(ctx, CHART_COLORS.purple),
            fill: true,
            borderWidth: 2,
            tension: 0.4,
          }]
        },
        options: makeChartOptions(CHART_COLORS.purple)
      });
    }
    if (stackChartRef.current) {
      const ctx = stackChartRef.current.getContext('2d');
      chartsRef.current.stack = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Empty', 'Level 1', 'Level 2', 'Level 3'],
          datasets: [{
            data: [stackLevels[0], stackLevels[1], stackLevels[2], stackLevels[3]],
            borderColor: CHART_COLORS.amber,
            backgroundColor: makeGradient(ctx, CHART_COLORS.amber),
            fill: true,
            borderWidth: 2,
            tension: 0.4,
          }]
        },
        options: makeChartOptions(CHART_COLORS.amber)
      });
    }
    return () => { Object.values(chartsRef.current).forEach(c => c && c.destroy()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, yard]);

  return (
    <div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Type</th><th>Size</th>
              <th>Priority</th><th>Weight</th><th>Destination</th>
              <th>Arrival</th><th>Departure</th><th>Location</th><th>Level</th>
            </tr>
          </thead>
          <tbody>
            {containers.length === 0 ? (
              <tr className="empty-row"><td colSpan="11">No containers available.</td></tr>
            ) : (
              containers.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.type}</td>
                  <td>{c.size}</td>
                  <td><span className={`priority-badge priority-${c.priority}`}>{c.priority?.toUpperCase()}</span></td>
                  <td>{c.weight} kg</td>
                  <td>{c.destination}</td>
                  <td>{c.arrivalDate}</td>
                  <td>{c.departureDate}</td>
                  <td>{c.location}</td>
                  <td>{c.level}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="analytics-container">
        <h2 className="analytics-heading">Analytics Dashboard</h2>
        <div className="kpi-row">
          <div className="kpi-card kpi-total"><h3>Total Containers</h3><div className="kpi-value">{total}</div></div>
          <div className="kpi-card kpi-high"><h3>High Priority</h3><div className="kpi-value">{high}</div></div>
          <div className="kpi-card kpi-avg"><h3>Avg Stack Height</h3><div className="kpi-value">{avgStack}</div></div>
          <div className="kpi-card kpi-low"><h3>Low Priority</h3><div className="kpi-value">{low}</div></div>
        </div>

        {total > 0 && (
          <>
            <div className="charts-row">
              <div className="chart-card">
                <div className="chart-title">By Section</div>
                <canvas ref={sectionChartRef} />
              </div>
              <div className="chart-card">
                <div className="chart-title">Container Types</div>
                <canvas ref={typeChartRef} />
              </div>
            </div>
            <div className="charts-row">
              <div className="chart-card">
                <div className="chart-title">Stack Height Distribution</div>
                <canvas ref={stackChartRef} />
              </div>
            </div>
          </>
        )}

        <div className="insights-panel">
          {insights.map((ins, i) => <p key={i} style={{ margin: '4px 0' }}>{ins}</p>)}
        </div>
      </div>
    </div>
  );
}
