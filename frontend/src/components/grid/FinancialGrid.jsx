import { AgGridReact } from 'ag-grid-react'
import { useMemo, useRef, useCallback, useState } from 'react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import { fmtNumber } from '../../utils/formatters'
import { isHiddenHeaderRow, resolveRowLevel } from '../../utils/statementDisplay'

// Register AG Grid modules (required in v32+)
ModuleRegistry.registerModules([AllCommunityModule])
// NOTE: v33 uses the Theming API (Quartz by default). Do NOT import the
// legacy ag-grid.css / ag-theme-*.css files — mixing both triggers AG Grid
// error #239 and double-applies theme styles.

/**
 * FinancialGrid — AG Grid Community Edition wrapper.
 *
 * Props:
 *   rows       {Array}    — Internal FinancialRow objects from the API
 *   years      {string[]} — Ordered fiscal year columns ["2021","2022",...]
 *   editable   {boolean}  — Enable cell editing (default: false)
 *   onCellEdit {function} — Callback (rowId, year, newValue) on cell change
 */
export default function FinancialGrid({
  rows = [],
  years = [],
  editable = false,
  onCellEdit,
  onCellEditingStopped,
  projectIndustry = 'general',
}) {
  const gridRef = useRef()

  const [decimals, setDecimals] = useState(0)

  // Determine if a row is editable (not a header, not a subtotal, and matches industry)
  const isRowEditable = useCallback((params) => {
    if (!editable) return false
    const data = params.data
    if (!data) return false
    if (data.is_header === true) return false
    if (data.is_subtotal === true) return false
    
    // Check industry relevance
    if (projectIndustry !== 'general' && data.industry && data.industry !== 'general' && data.industry !== projectIndustry) {
      return false; // Disable if row is for a different specific industry
    }
    
    return true
  }, [editable, projectIndustry])

  // Label column — always pinned left, never editable
  const labelCol = {
    field: 'label',
    headerName: 'Line Item',
    pinned: 'left',
    width: 300,
    editable: false,
    cellStyle: (params) => {
      const level = resolveRowLevel(params.data)

      let bg = undefined
      if (params.data?.is_header || params.data?.is_subtotal) bg = '#f5f5f5'
      
      let opacity = 1
      if (projectIndustry !== 'general' && params.data?.industry && params.data?.industry !== 'general' && params.data?.industry !== projectIndustry) {
        opacity = 0.35 // Fade out rows that don't apply to the selected industry
      }
      
      return {
        fontWeight: level === 1 ? '700' : level === 2 ? '600' : '400',
        fontSize: level === 1 ? '15px' : level === 2 ? '14px' : '13px',
        color: level <= 2 ? 'var(--color-navy)' : 'var(--color-text)',
        background: bg,
        paddingLeft: `${(level - 1) * 20 + 8}px`, // Adjusted indentation for clearer hierarchy
        borderTop: level === 1 ? '1px solid var(--color-border)' : 'none',
        whiteSpace: 'pre',
        opacity: opacity,
        cursor: opacity < 1 ? 'not-allowed' : 'default',
      }
    },
  }

  // Year value columns — generated dynamically
  const yearCols = useMemo(() =>
    years.map((year) => ({
      field: String(year),
      headerName: String(year),
      width: 150,
      headerClass: 'ag-header-cell-center',
      editable: isRowEditable,
      cellEditor: 'agTextCellEditor',
      valueFormatter: (p) => {
        // If row is for a different specific industry, render as a dash
        if (projectIndustry !== 'general' && p.data?.industry && p.data?.industry !== 'general' && p.data?.industry !== projectIndustry) {
          return '—'
        }
        
        if (p.value == null || p.value === '') return '—'

        if (isHiddenHeaderRow(p.data)) return ''

        const num = Number(p.value)
        const formatted = fmtNumber(num, decimals)
        if (p.data?.key === 'balanceCheck') {
          if (num > 0.5)  return `+${formatted}` // assets surplus
          if (num < -0.5) return formatted        // E+L surplus (negative sign already present)
          return '0'                              // perfectly balanced
        }
        return formatted
      },
      valueParser: (p) => {
        let cleaned = String(p.newValue).replace(/,/g, '').trim()
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
          cleaned = '-' + cleaned.slice(1, -1)
        }
        const num = Number(cleaned)
        return isNaN(num) ? 0 : num
      },
      cellStyle: (params) => {
        const level = resolveRowLevel(params.data)

        let bg = undefined
        if (params.data?.is_header || params.data?.is_subtotal) bg = '#f5f5f5'
        
        let txtColor = undefined;
        if (params.data?.key === 'balanceCheck') {
            if (params.value > 0.5)  txtColor = '#10B981'; // Green — assets surplus
            else if (params.value < -0.5) txtColor = '#DC2626'; // Red — E+L surplus
            else txtColor = '#10B981'; // Green — exactly balanced
        } else if (params.value < 0) {
            txtColor = 'var(--color-error)';
        }
        
        let opacity = 1
        if (projectIndustry !== 'general' && params.data?.industry && params.data?.industry !== 'general' && params.data?.industry !== projectIndustry) {
          opacity = 0.35 // Fade out rows that don't apply to the selected industry
          txtColor = 'var(--color-text-muted)' // Override any red/green colors if disabled
        }
        
        return {
          textAlign: 'center',
          color: txtColor,
          fontWeight: level === 1 ? '700' : level === 2 ? '600' : '400',
          fontSize: level === 1 ? '15px' : level === 2 ? '14px' : '13px',
          background: bg,
          borderTop: level === 1 ? '1px solid var(--color-border)' : 'none',
          opacity: opacity,
          cursor: opacity < 1 ? 'not-allowed' : (params.data?.is_header || params.data?.is_subtotal ? 'default' : 'text'),
        }
      },
    })),
  [years, isRowEditable, decimals, projectIndustry])

  // Flatten rows for AG Grid (values dict → flat object)
  const rowData = useMemo(() =>
    rows.map((row) => ({
      row_id: row.row_id,
      label: row.label_raw || row.label,
      section: row.section,
      level: row.level,
      is_subtotal: row.is_subtotal,
      is_header: row.is_header,
      industry: row.industry || 'general',
      key: row.key,
      ...row.values,
    })),
  [rows])

  return (
    <div style={{ width: '100%', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px', gap: '6px' }}>
        <button 
          onClick={() => setDecimals(prev => prev + 1)}
          title="Increase Decimal"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '2px 6px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--color-navy)',
            lineHeight: 1.1,
            fontFamily: 'monospace',
            width: '36px',
            height: '32px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ color: '#0078D4', fontSize: '13px', fontWeight: 'bold' }}>←</span>
            <span style={{ fontSize: '10px' }}>.0</span>
          </div>
          <div style={{ fontSize: '10px', alignSelf: 'flex-end', paddingRight: '2px' }}>.00</div>
        </button>
        <button 
          onClick={() => setDecimals(prev => Math.max(0, prev - 1))}
          title="Decrease Decimal"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '2px 6px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            cursor: decimals > 0 ? 'pointer' : 'not-allowed',
            color: 'var(--color-navy)',
            lineHeight: 1.1,
            fontFamily: 'monospace',
            width: '36px',
            height: '32px',
            opacity: decimals > 0 ? 1 : 0.5
          }}
          disabled={decimals === 0}
        >
          <div style={{ fontSize: '10px', alignSelf: 'flex-start', paddingLeft: '2px' }}>.00</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ color: '#0078D4', fontSize: '13px', fontWeight: 'bold' }}>→</span>
            <span style={{ fontSize: '10px' }}>.0</span>
          </div>
        </button>
      </div>
      <div style={{ width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={[labelCol, ...yearCols]}
          defaultColDef={{ resizable: true, sortable: false }}
          suppressMovableColumns
          domLayout="autoHeight"
          getRowId={(p) => p.data.row_id}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          onCellValueChanged={(e) => {
            if (onCellEdit && e.colDef.field !== 'label') {
              onCellEdit(e.data.row_id, e.colDef.field, e.newValue)
            }
            if (onCellEditingStopped) {
              onCellEditingStopped(e)
            }
          }}
        />
      </div>
    </div>
  )
}

