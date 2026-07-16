import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { unitLabel } from '../utils/formatters';
import FinancialGrid from './grid/FinancialGrid';

export default function ManualEntryTemplate({ projectId, onComplete, onExit }) {
  const { project, saveStatus, addYear, removeYear, changeStartYear } = useProjectStore();

  const [activeTab, setActiveTab] = useState('income_statement');
  const [error, setError] = useState(null);
  const [newYearInput, setNewYearInput] = useState('');
  const [startYearEdit, setStartYearEdit] = useState('');
  const [projectIndustry, setProjectIndustry] = useState('general');

  // ============ REMOVED: The initialization guard clause is gone ============
  // This component now assumes the project is already initialized
  // The initialization is handled in FinancialStatements.jsx
  // ============

  const handleAddYear = () => {
    const y = String(newYearInput).trim();
    if (y.length === 4 && /^\d{4}$/.test(y)) {
      const currentYears = project?.income_statement?.years || [];
      if (!currentYears.includes(y)) {
        addYear(y);
      }
      setNewYearInput('');
    }
  };

  const handleRemoveYear = (yearToRemove) => {
    const currentYears = project?.income_statement?.years || [];
    if (currentYears.length <= 1) return;
    removeYear(yearToRemove);
  };

  const handleCellEdit = (rowId, year, newValue) => {
    useProjectStore.getState().updateCellValue(activeTab, rowId, year, newValue);
  };

  const TABS = [
    { id: 'income_statement', label: 'Income Statement' },
    { id: 'balance_sheet', label: 'Balance Sheet' },
    { id: 'cash_flow_statement', label: 'Cash Flow' }
  ];

  const years = project.income_statement.years || [];

  return (
    <div className="card">
      <div className="card-header" style={{ justifyContent: 'space-between' }}>
        <span className="card-title">Manual Data Entry</span>

        <span style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', color:
          saveStatus === 'saving' ? 'var(--color-warning, #F59E0B)' :
          saveStatus === 'saved' ? 'var(--color-success, #10B981)' :
          saveStatus === 'error' ? 'var(--color-error, #EF4444)' :
          'transparent'
        }}>
          {saveStatus === 'saving' && (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', animation: 'pulse 1s infinite' }} />
              Saving...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981' }} />
              All changes saved
            </>
          )}
          {saveStatus === 'error' && '✕ Save failed' }
        </span>
      </div>

      <div className="tabs" style={{ padding: '0 1rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 16px', fontSize: '14px', borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : 'none' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card-body">
        {error && <p className="field-error" style={{ marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <p style={{ color: 'var(--color-text-light)', margin: 0, fontSize: '13px' }}>
              Enter all figures in <strong>thousands ({unitLabel(project?.currency || 'SAR')})</strong> — including
              share counts. Subtotals update automatically.
            </p>
            
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
              <button 
                className={`btn btn-sm ${projectIndustry === 'general' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none', borderRight: '1px solid var(--color-border)' }}
                onClick={() => setProjectIndustry('general')}
              >
                All Rows
              </button>
              <button 
                className={`btn btn-sm ${projectIndustry === 'manufacturing' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none', borderRight: '1px solid var(--color-border)' }}
                onClick={() => setProjectIndustry('manufacturing')}
              >
                Manufacturing
              </button>
              <button 
                className={`btn btn-sm ${projectIndustry === 'service' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, border: 'none' }}
                onClick={() => setProjectIndustry('service')}
              >
                Service
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)', margin: 0 }}>Start Year:</label>
              <input
                type="number"
                className="input"
                value={startYearEdit !== '' ? startYearEdit : (years[0] || '')}
                onChange={(e) => setStartYearEdit(e.target.value)}
                onBlur={(e) => {
                  const val = String(e.target.value).trim();
                  if (val && val !== String(years[0])) changeStartYear(val, years[0]);
                  setStartYearEdit('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = String(e.target.value).trim();
                    if (val && val !== String(years[0])) changeStartYear(val, years[0]);
                    setStartYearEdit('');
                    e.target.blur();
                  }
                }}
                style={{ width: '80px', padding: '4px 8px', height: '32px', textAlign: 'center' }}
                title="Type a year and press Enter or click away to change"
              />
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border, #d1d5db)' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                placeholder="Year"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddYear()}
                style={styles.yearInput}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleAddYear} title="Add specified year">
                <i className="fa-solid fa-plus"></i> Add Year
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const y = String(newYearInput).trim();
                  if (y) handleRemoveYear(y);
                }}
                disabled={years.length <= 1}
                title="Remove specified year"
              >
                <i className="fa-solid fa-minus"></i> Remove Year
              </button>
            </div>
          </div>
        </div>

        <FinancialGrid
          rows={project[activeTab]?.rows || []}
          years={years}
          editable={true}
          height="500px"
          onCellEdit={handleCellEdit}
          projectIndustry={projectIndustry}
          unitCaption={`Figures in ${unitLabel(project?.currency || 'SAR')} (thousands)`}
        />

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}>
          {onExit && (
            <button className="btn btn-secondary" onClick={onExit}>
              <i className="fa-solid fa-arrow-left"></i> Back to Main View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  yearInput: {
    width: '70px',
    padding: '4px 8px',
    fontSize: '13px',
    border: '1px solid var(--color-border, #d1d5db)',
    borderRadius: '4px',
    textAlign: 'center',
  }
};
