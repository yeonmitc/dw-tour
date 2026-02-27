export default function Loading({ label = 'Loading...' }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</div>
    </div>
  )
}
