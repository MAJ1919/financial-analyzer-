import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import FinancialGrid from '../../components/grid/FinancialGrid';
import { useProjectStore } from '../../store/projectStore';

export default function CashFlowStatement() {
  const { projectId } = useParams();
  const { project, updateCellValue, saveManualEdits } = useProjectStore();
  const saveTimeoutRef = useRef(null);

  const handleCellEdit = React.useCallback((rowId, year, newValue) => {
    updateCellValue('cash_flow_statement', rowId, year, newValue);
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

  if (!project || !project.cash_flow_statement) return <div className="empty-state">No Cash Flow Statement data available.</div>;

  const { rows, years } = project.cash_flow_statement;

  return (
    <FinancialGrid
      rows={rows || []}
      years={years || []}
      editable={false} // CFS should be fully derived from IS and BS
      height="60vh"
      onCellEdit={handleCellEdit}
      onCellEditingStopped={handleCellEditingStopped}
    />
  );
}
