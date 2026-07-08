import { create } from 'zustand';
import { uploadApi } from '../services/api';
import { recalculateTotals, deriveCashFlow } from '../utils/calculations';
import TEMPLATE_STRUCTURE from '../utils/statementTemplateStructure.json'; // <-- IMPORT THIS

let debounceTimeoutRef = null;
let statusTimeoutRef = null;

export const useProjectStore = create((set, get) => ({
  project: null,
  saveStatus: 'idle',
  setProject: (project) => {
    // When loading from backend, re-derive cash flow from IS+BS so it's always linked
    if (project?.income_statement?.rows && project?.balance_sheet?.rows && project?.cash_flow_statement?.rows) {
      try {
        // First recalculate IS and BS totals from their raw data
        project.income_statement.rows = recalculateTotals('income_statement', project.income_statement.rows);
        project.balance_sheet.rows = recalculateTotals('balance_sheet', project.balance_sheet.rows);
        // Then derive cash flow from the recalculated IS+BS
        project.cash_flow_statement.rows = deriveCashFlow(
          project.income_statement.rows,
          project.balance_sheet.rows,
          project.cash_flow_statement.rows,
          project.cash_flow_statement.years
        );
      } catch (err) {
        console.error('Error re-deriving cash flow on project load:', err);
      }
    }
    set({ project });
  },
  
  initializeManualStatements: (startYear = new Date().getFullYear()) => {
    const state = get();
    try {
      // Only initialize if statements don't exist yet
      if (state.project?.income_statement) return;

      const project = { ...state.project } || {};
      const years = [String(startYear)];

      const templateData = TEMPLATE_STRUCTURE.default || TEMPLATE_STRUCTURE;

      const buildEmptyStatement = (type) => {
        const rows = templateData[type].map((row, index) => ({
          row_id: `${type}_${index}`,
          label: row.label,
          key: row.key,
          section: row.section,
          level: row.level,
          is_subtotal: row.is_subtotal || false,
          is_header: row.is_header || false,
          industry: row.industry || 'general',
          values: { [startYear]: 0 }, // Start with 0s
          order: index,
        }));
        return { years, rows };
      };

      project.income_statement = buildEmptyStatement('income_statement');
      project.balance_sheet = buildEmptyStatement('balance_sheet');
      project.cash_flow_statement = buildEmptyStatement('cash_flow_statement');
      
      // Recalculate all totals after initialization
      project.income_statement.rows = recalculateTotals('income_statement', project.income_statement.rows);
      project.balance_sheet.rows = recalculateTotals('balance_sheet', project.balance_sheet.rows);
      project.cash_flow_statement.rows = deriveCashFlow(
        project.income_statement.rows,
        project.balance_sheet.rows,
        project.cash_flow_statement.rows,
        project.cash_flow_statement.years
      );
      
      set({ project, saveStatus: 'unsaved' });
      
      // Persist the initialized template to the backend immediately
      const projectId = state.project?.project_id || state.project?.id;
      if (projectId) {
        get().saveManualEdits(projectId);
      }
    } catch (err) {
      console.error("Initialization Error:", err);
      set({ saveStatus: 'error' });
    }
  },

  updateCellValue: (statementType, rowId, year, value) => {
    set((state) => {
      if (!state.project) return state;
      const project = { ...state.project };
      if (!project[statementType]) return state;
      
      const statement = { ...project[statementType] };
      const rows = [...(statement.rows || [])];
      
      const rowIndex = rows.findIndex(r => r.row_id === rowId);
      if (rowIndex !== -1) {
        rows[rowIndex] = {
          ...rows[rowIndex],
          values: { ...rows[rowIndex].values, [year]: value }
        };
        
        statement.rows = recalculateTotals(statementType, rows);
        project[statementType] = statement;
        
        if (statementType === 'income_statement' || statementType === 'balance_sheet') {
          if (project.income_statement && project.balance_sheet && project.cash_flow_statement) {
             project.cash_flow_statement = {
               ...project.cash_flow_statement,
               rows: deriveCashFlow(
                  project.income_statement.rows,
                  project.balance_sheet.rows,
                  project.cash_flow_statement.rows,
                  project.cash_flow_statement.years
               )
             };
          }
        }
      }
      
      return { project, saveStatus: 'unsaved' };
    });

    // ---> NEW: TRIGGER AUTOSAVE IMMEDIATELY AFTER TYPING <---
    const projectId = get().project?.project_id || get().project?.id;
    if (projectId) {
      if (debounceTimeoutRef) clearTimeout(debounceTimeoutRef);
      debounceTimeoutRef = setTimeout(() => {
        get().saveManualEdits(projectId);
      }, 1000); // Autosave 1 second after user stops typing
    }
  },

  addYear: (newYear) => {
    set((state) => {
      if (!state.project) return state;
      const project = { ...state.project };
      
      const statements = ['income_statement', 'balance_sheet', 'cash_flow_statement'];
      statements.forEach(stmt => {
        if (project[stmt] && project[stmt].years) {
          const years = [...project[stmt].years];
          if (!years.includes(newYear)) {
            years.push(newYear);
            years.sort((a, b) => a - b);
            
            const rows = (project[stmt].rows || []).map(row => ({
              ...row,
              values: { ...row.values, [newYear]: 0 }
            }));
            
            project[stmt] = { ...project[stmt], years, rows };
          }
        }
      });
      
      project.income_statement.rows = recalculateTotals('income_statement', project.income_statement.rows);
      project.balance_sheet.rows = recalculateTotals('balance_sheet', project.balance_sheet.rows);
      project.cash_flow_statement.rows = deriveCashFlow(
        project.income_statement.rows,
        project.balance_sheet.rows,
        project.cash_flow_statement.rows,
        project.cash_flow_statement.years
      );
      
      return { project, saveStatus: 'unsaved' };
    });
    // Autosave the new year structure
    const projectId = get().project?.project_id || get().project?.id;
    if (projectId) get().saveManualEdits(projectId);
  },

  removeYear: (yearToRemove) => {
    set((state) => {
      if (!state.project) return state;
      const project = { ...state.project };
      
      const statements = ['income_statement', 'balance_sheet', 'cash_flow_statement'];
      statements.forEach(stmt => {
        if (project[stmt] && project[stmt].years) {
          const years = project[stmt].years.filter(y => Number(y) !== Number(yearToRemove));
          
          const rows = (project[stmt].rows || []).map(row => {
            const newValues = { ...row.values };
            delete newValues[yearToRemove];
            return { ...row, values: newValues };
          });
          
          // Recalculate IS and BS totals individually
          if (stmt !== 'cash_flow_statement') {
            project[stmt] = { ...project[stmt], years, rows: recalculateTotals(stmt, rows) };
          } else {
            project[stmt] = { ...project[stmt], years, rows };
          }
        }
      });
      
      // Re-derive CFS from IS+BS after year removal
      if (project.income_statement && project.balance_sheet && project.cash_flow_statement) {
        project.cash_flow_statement.rows = deriveCashFlow(
          project.income_statement.rows,
          project.balance_sheet.rows,
          project.cash_flow_statement.rows,
          project.cash_flow_statement.years
        );
      }
      
      return { project, saveStatus: 'unsaved' };
    });
    const projectId = get().project?.project_id || get().project?.id;
    if (projectId) get().saveManualEdits(projectId);
  },

  changeStartYear: (newStartYear, oldStartYear) => {
    set((state) => {
      if (!state.project) return state;
      const project = { ...state.project };
      
      const statements = ['income_statement', 'balance_sheet', 'cash_flow_statement'];
      statements.forEach(stmt => {
        if (project[stmt] && project[stmt].years) {
          const years = [...project[stmt].years]; // Copy array to prevent mutating state/shared references
          const index = years.indexOf(String(oldStartYear));
          
          if (index !== -1) {
            // If the target year already exists, we simply remove the old year to prevent duplicates
            if (years.includes(String(newStartYear))) {
              const newYears = years.filter(y => y !== String(oldStartYear));
              
              const rows = (project[stmt].rows || []).map(row => {
                const newValues = { ...row.values };
                delete newValues[oldStartYear]; // Remove old data, keep existing new data
                return { ...row, values: newValues };
              });
              
              project[stmt] = { ...project[stmt], years: newYears, rows };
            } else {
              years[index] = String(newStartYear);
              years.sort((a, b) => a - b);
              
              const rows = (project[stmt].rows || []).map(row => {
                const newValues = { ...row.values };
                newValues[newStartYear] = newValues[oldStartYear] || 0;
                delete newValues[oldStartYear];
                return { ...row, values: newValues };
              });
              
              project[stmt] = { ...project[stmt], years, rows };
            }
          }
        }
      });
      
      // Recalculate all totals after year rename
      if (project.income_statement?.rows) {
        project.income_statement.rows = recalculateTotals('income_statement', project.income_statement.rows);
      }
      if (project.balance_sheet?.rows) {
        project.balance_sheet.rows = recalculateTotals('balance_sheet', project.balance_sheet.rows);
      }
      if (project.income_statement && project.balance_sheet && project.cash_flow_statement) {
        project.cash_flow_statement.rows = deriveCashFlow(
          project.income_statement.rows,
          project.balance_sheet.rows,
          project.cash_flow_statement.rows,
          project.cash_flow_statement.years
        );
      }
      
      return { project, saveStatus: 'unsaved' };
    });
    const projectId = get().project?.project_id || get().project?.id;
    if (projectId) get().saveManualEdits(projectId);
  },

  // Save changes to backend
  saveManualEdits: async (projectId) => {
    const { project } = get();
    if (!project) return;
    
    set({ saveStatus: 'saving' });
    
    try {
      const payload = {
        income_statement: project.income_statement,
        balance_sheet: project.balance_sheet,
        cash_flow_statement: project.cash_flow_statement
      };
      await uploadApi.saveManual(projectId, payload);
      set({ saveStatus: 'saved' });
      
      if (statusTimeoutRef) clearTimeout(statusTimeoutRef);
      statusTimeoutRef = setTimeout(() => {
        const current = get().saveStatus;
        if (current === 'saved') set({ saveStatus: 'idle' });
      }, 3000);
    } catch (error) {
      console.error('Failed to auto-save manual edits:', error);
      set({ saveStatus: 'unsaved' }); 
    }
  }
}));
