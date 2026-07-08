import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import FinancialGrid from '../../components/grid/FinancialGrid';
import { useProjectStore } from '../../store/projectStore';

export default function IncomeStatement() {
  const { projectId } = useParams();
  const { project, updateCellValue, saveManualEdits } = useProjectStore();
  const saveTimeoutRef = useRef(null);

  const handleCellEdit = React.useCallback((rowId, year, newValue) => {
    updateCellValue('income_statement', rowId, year, newValue);
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

  if (!project || !project.income_statement) return <div className="empty-state">No Income Statement data available.</div>;

  const { rows, years } = project.income_statement;

  return (
    <FinancialGrid
      rows={rows || []}
      years={years || []}
      editable
      height="60vh"
      onCellEdit={handleCellEdit}
      onCellEditingStopped={handleCellEditingStopped}
    />
  );
}
