/**
 * Skeleton placeholders.
 *
 * Used instead of a bare spinner wherever we already know the *shape* of the
 * content that is coming. Reserving that space stops the layout from jumping
 * when data resolves, and reads as faster than a spinner on the same latency.
 *
 * Motion is handled in index.css and is disabled under prefers-reduced-motion
 * (the block stays visible, it just stops shimmering).
 */

/** A single grey bar. `w` accepts any CSS width. */
export function SkeletonLine({ w = '100%', h = 12, style }) {
  return (
    <div
      className="skeleton skeleton-text"
      style={{ width: w, height: h, ...style }}
      aria-hidden="true"
    />
  )
}

/**
 * Table placeholder: a header bar plus `rows` body bars.
 * aria-busy + a polite live label so screen readers announce loading
 * rather than reading a stack of empty divs.
 */
export function SkeletonTable({ rows = 6, showHeader = true, label = 'Loading data' }) {
  return (
    <div className="skeleton-table" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {showHeader && (
        <div className="skeleton skeleton-row" style={{ height: 30, marginBottom: 10 }} aria-hidden="true" />
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-row"
          aria-hidden="true"
          // Slight width variance so it reads as content, not a solid block.
          style={{ width: i % 3 === 2 ? '88%' : i % 2 ? '96%' : '100%' }}
        />
      ))}
    </div>
  )
}

/** Placeholder for a row of KPI/metric cards. */
export function SkeletonMetrics({ count = 4, label = 'Loading metrics' }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          aria-hidden="true"
          style={{ height: 64, flex: '1 1 140px', minWidth: 140 }}
        />
      ))}
    </div>
  )
}

export default SkeletonTable
