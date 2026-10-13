import { useState, type FormEvent } from 'react'
import { ArrowRight, LocateFixed, Search, X } from 'lucide-react'
import type { City } from './types'

type Props = {
  busy: boolean
  cities: City[]
  hasArea: boolean
  radius: number
  onNearMe: () => void
  onSearch: (query: string) => void
  onCity: (city: City) => void
  onRadius: (radius: number) => void
  onClear: () => void
}

export default function LocationDiscovery({ busy, cities, hasArea, radius, onNearMe, onSearch, onCity, onRadius, onClear }: Props) {
  const [query, setQuery] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (query.trim().length >= 2) onSearch(query.trim())
  }
  return <div className="discovery-location">
    <div className="discovery-location-row">
      <button className="primary discover-near" onClick={onNearMe} disabled={busy}><LocateFixed size={20} /> Discover near me</button>
      <span className="discovery-or">or</span>
      <form className="discovery-city-form" onSubmit={submit}>
        <label htmlFor="restaurant-city">Choose a city</label>
        <div className="discovery-city-field"><Search size={18} aria-hidden="true" /><input id="restaurant-city" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="City or neighborhood" autoComplete="off" minLength={2} maxLength={100} required disabled={busy} /><button type="submit" aria-label="Search cities" disabled={busy || query.trim().length < 2}><ArrowRight size={22} /></button></div>
      </form>
      <div className="discovery-radius"><label htmlFor="restaurant-radius">Look within</label><select id="restaurant-radius" value={radius} disabled={busy} onChange={event => onRadius(Number(event.target.value))}><option value={5}>5 km</option><option value={10}>10 km</option><option value={15}>15 km</option><option value={25}>25 km · wider search</option></select></div>
      {hasArea && <button className="discovery-clear" onClick={onClear} aria-label="Clear restaurant location"><X size={18} /> Clear</button>}
    </div>
    {cities.length > 0 && <div className="discovery-city-choices"><p>Which place did you have in mind?</p><ul>{cities.map(city => <li key={city.id}><button onClick={() => onCity(city)} disabled={busy}>{city.label}<ArrowRight size={18} /></button></li>)}</ul></div>}
    <p className="discovery-privacy">Only when you choose: your approximate area is shared with Photon and OpenStreetMap services to find places. No tracking or saved location. City search works without device permission.</p>
  </div>
}
