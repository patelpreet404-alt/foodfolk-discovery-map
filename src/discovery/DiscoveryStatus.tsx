import { ArrowRight, Compass, LoaderCircle, MapPinOff } from 'lucide-react'

type Props = { kind: 'loading' | 'empty' | 'error'; title: string; message: string; onRetry?: () => void; onExpand?: () => void }

export default function DiscoveryStatus({ kind, title, message, onRetry, onExpand }: Props) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'empty' ? Compass : MapPinOff
  return <div className={`discovery-status discovery-status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <Icon size={34} aria-hidden="true" />
    <div><h3>{title}</h3><p>{message}</p>{onRetry && <button onClick={onRetry}>Try again <ArrowRight size={18} /></button>}{onExpand && <button className="primary" onClick={onExpand}>Expand to 25 km <ArrowRight size={18} /></button>}</div>
  </div>
}
