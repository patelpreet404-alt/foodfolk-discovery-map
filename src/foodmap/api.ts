import { demoApi } from './demoApi'

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.MODE === 'demo') return demoApi<T>(path, options)
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.')
  return payload
}
