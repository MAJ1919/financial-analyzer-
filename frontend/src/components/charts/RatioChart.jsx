import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = [
  '#0D7377', '#1B2A4A', '#14a8ad', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444',
]

/**
 * RatioChart — Recharts line chart for ratio trend visualisation.
 *
 * Props:
 *   ratioGroup   {Object}   — e.g. { "Current Ratio": {"2021": 1.5, "2022": 1.6} }
 *   years        {string[]} — Ordered year labels
 *   title        {string}   — Chart card title
 */
export default function RatioChart({ ratioGroup = {}, years = [], title }) {
  if (!years.length || !Object.keys(ratioGroup).length) {
    return <p className="text-muted text-center">No ratio data available.</p>
  }

  const data = years.map((year) => {
    const point = { year }
    for (const [ratioId, values] of Object.entries(ratioGroup)) {
      const name = values.label || ratioId
      point[name] = values[year] ?? null
    }
    return point
  })

  // Extract the unique names used in the data points
  const ratioNames = Object.keys(ratioGroup).map(key => ratioGroup[key].label || key)

  return (
    <div className="card">
      {title && (
        <div className="card-header">
          <span className="card-title">{title}</span>
        </div>
      )}
      <div className="card-body">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--color-navy)',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {ratioNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
