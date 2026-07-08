export default function Header({ title, subtitle, actions }) {
  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div style={styles.actions}>{actions}</div>}
    </header>
  )
}

const styles = {
  header: {
    height: 'var(--header-height)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-navy)',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
}
