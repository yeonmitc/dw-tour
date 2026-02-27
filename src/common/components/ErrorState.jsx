export default function ErrorState({ title = 'Error', error }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
        {error?.message ?? String(error ?? '')}
      </div>
    </div>
  )
}
