export default function Badge({ variant = 'default', children }) {
  const cls = variant === 'good' ? 'badge good' : variant === 'warn' ? 'badge warn' : variant === 'bad' ? 'badge bad' : 'badge'
  return <span className={cls}>{children}</span>
}
