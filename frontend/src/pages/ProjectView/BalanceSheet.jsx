import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import FinancialGrid from '../../components/grid/FinancialGrid';
import { useProjectStore } from '../../store/projectStore';

export default function BalanceSheet() {
  const { projectId } = useParams();
  const { project, updateCellValue, saveManualEdits } = useProjectStore();
  const saveTimeoutRef = useRef(null);

  const handleCellEdit = React.useCallback((rowId, year, newValue) => {
    updateCellValue('balance_sheet', rowId, year, newValue);
  }, [updateCellValue]);

  const handleCellEditingStopped = React.useCallback((e) => {
    if (e.newValue !== e.oldValue) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveManualEdits(projectId);
      }, 2000);
    }
  }, [saveManualEdits, projectId]);

  if (!project || !project.balance_sheet) return <div className="empty-state">No Balance Sheet data available.</div>;

  const { rows, years } = project.balance_sheet;

  // Calculate imbalances
  const imbalances = [];
  if (rows && years) {
    const assetsRow = rows.find(r => r.row_id === 'totalAssets' || r.row_id === 'total_assets');
    const liabEquityRow = rows.find(r => r.row_id === 'totalLiabilitiesAndEquity' || r.row_id === 'total_liabilities_and_equity');
    
    if (assetsRow && liabEquityRow) {
      years.forEach(year => {
        const assets = assetsRow.values?.[year] || 0;
        const liabEq = liabEquityRow.values?.[year] || 0;
        if (Math.abs(assets - liabEq) > 1) { // 1 unit tolerance for rounding
          imbalances.push({ year, diff: assets - liabEq });
        }
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {imbalances.length > 0 && (
        <div style={{ 
          background: 'rgba(255, 90, 90, 0.1)', 
          border: '1px solid rgba(255, 90, 90, 0.3)', 
          color: 'var(--color-danger, #FF5A5A)', 
          padding: '12px 16px', 
          borderRadius: 'var(--radius-sm)', 
          marginBottom: '16px',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          <div>
            Warning: Balance Sheet does not balance in <strong>{imbalances.map(i => i.year).join(', ')}</strong>. 
            (Off by: {imbalances.map(i => `${i.year}: ${i.diff > 0 ? '+' : ''}${i.diff.toLocaleString()}`).join(', ')})
          </div>
        </div>
      )}
      <FinancialGrid
      rows={rows || []}
      years={years || []}
      editable
      height="60vh"
      onCellEdit={handleCellEdit}
      onCellEditingStopped={handleCellEditingStopped}
    />
    </div>
  );
}
