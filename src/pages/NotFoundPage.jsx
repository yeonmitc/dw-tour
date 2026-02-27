import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: 16 }}>
      <div className="card">
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Page not found</div>
        <div style={{ color:'var(--muted)', fontSize: 13 }}>경로가 없습니다.</div>
        <hr />
        <Link className="btn" to="/">Go home</Link>
      </div>
    </div>
  )
}
