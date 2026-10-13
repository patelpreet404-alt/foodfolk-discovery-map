import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Compass } from 'lucide-react'
import RecipeArt from '../RecipeArt'
import LocationDiscovery from './LocationDiscovery'
import DiscoveryStatus from './DiscoveryStatus'
import { RestaurantCarousel } from './RestaurantSpotlight'
import { coarsePoint, discoverRestaurants, reverseArea, searchCities } from './data'
import type { City, Point, Restaurant } from './types'
import './discovery.css'

type Area = { point: Point; label: string; basis: 'device' | 'city' }
type Phase = 'idle' | 'locating' | 'cities' | 'searching' | 'ready' | 'empty' | 'error'

export default function RestaurantDiscovery() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [cities, setCities] = useState<City[]>([])
  const [area, setArea] = useState<Area | null>(null)
  const [radius, setRadius] = useState(10)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [message, setMessage] = useState('')
  const [citySearching, setCitySearching] = useState(false)
  const active = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const busy = phase === 'locating' || phase === 'searching' || citySearching

  useEffect(() => () => { requestId.current += 1; active.current?.abort() }, [])
  const begin = () => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const id = ++requestId.current
    setMessage('')
    return { signal: controller.signal, id }
  }
  const fail = (error: unknown, signal: AbortSignal) => {
    if (signal.aborted) return
    setPhase('error')
    setMessage(error instanceof Error ? error.message : 'The restaurant service is unavailable. Please try again or search another city.')
  }
  const searchArea = async (next: Area, distance = radius) => {
    const { signal, id } = begin()
    setArea(next); setCities([]); setRestaurants([]); setPhase('searching'); setCitySearching(false)
    try {
      const [places, name] = await Promise.all([
        discoverRestaurants(next.point, distance, signal),
        next.basis === 'device' ? reverseArea(next.point, signal).catch(() => next.label) : Promise.resolve(next.label),
      ])
      if (signal.aborted || id !== requestId.current) return
      setArea({ ...next, label: name }); setRestaurants(places); setPhase(places.length ? 'ready' : 'empty')
    } catch (error) { fail(error, signal) }
  }
  const nearMe = () => {
    const { signal, id } = begin()
    setPhase('locating'); setCities([]); setRestaurants([]); setArea(null); setCitySearching(false)
    if (!navigator.geolocation) {
      setPhase('error'); setMessage('This browser cannot provide a location. Search for a city below instead.'); return
    }
    navigator.geolocation.getCurrentPosition(position => {
      if (signal.aborted || id !== requestId.current) return
      // Discard precise device coordinates immediately; only the approximate point enters state.
      const point = coarsePoint({ lat: position.coords.latitude, lon: position.coords.longitude })
      void searchArea({ point, label: 'Your area', basis: 'device' })
    }, error => {
      if (signal.aborted || id !== requestId.current) return
      setPhase('error')
      setMessage(error.code === 1 ? 'Location permission is off. You can still discover restaurants by choosing a city below.' : error.code === 3 ? 'Finding your location took too long. Try again, or choose a city below.' : 'Your location is unavailable right now. Choose a city below to continue.')
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })
  }
  const citySearch = async (query: string) => {
    const { signal, id } = begin()
    setCitySearching(true); setCities([]); setRestaurants([]); setArea(null); setPhase('cities')
    try {
      const choices = await searchCities(query, signal)
      if (signal.aborted || id !== requestId.current) return
      setCities(choices)
      if (!choices.length) setMessage('No matching city found. Try a nearby city or add the country name.')
    } catch (error) { fail(error, signal) }
    finally { if (id === requestId.current) setCitySearching(false) }
  }
  const changeRadius = (value: number) => {
    setRadius(value)
    if (area) void searchArea(area, value)
  }
  const clear = () => {
    begin(); setArea(null); setRestaurants([]); setCities([]); setPhase('idle'); setCitySearching(false)
  }
  return <section id="around-your-table" className="restaurant-discovery" aria-labelledby="discovery-title">
    <div className="discovery-rule"><p className="editorial-label">AROUND YOUR TABLE</p><span><Compass size={18} /> A local culinary journal</span></div>
    <div className="discovery-heading"><div><h2 id="discovery-title">A little taste<br />of <span>{area?.label.split(',')[0] || 'your city'}.</span></h2><p>Extraordinary restaurants.<br />Delicious little stories.</p></div><div className="discovery-heading-note"><ArrowUpRight size={28} /><p>Meet the people, places<br />and ideas behind the plate.</p></div></div>
    <LocationDiscovery busy={busy} cities={cities} hasArea={!!area} radius={radius} onNearMe={nearMe} onSearch={query => void citySearch(query)} onCity={city => void searchArea({ point: coarsePoint(city.point), label: city.label, basis: 'city' })} onRadius={changeRadius} onClear={clear} />
    {phase === 'idle' && <div className="discovery-invitation"><div className="discovery-invitation-copy"><span className="discovery-number">01—</span><h3>Every great kitchen<br />has a story.</h3><p>A chef’s inspiration. A garden that shapes the menu. A dining room with a past. Find a little more to savour, close to you.</p><p className="discovery-small">Choose your location to begin. We look for fine-dining map tags and restaurants with documented stories.</p></div><div className="discovery-still-life" aria-hidden="true"><RecipeArt /><span className="discovery-stamp">GOOD FOOD.<br />GREAT STORIES.</span></div></div>}
    {(phase === 'locating' || phase === 'searching' || citySearching) && <DiscoveryStatus kind="loading" title={phase === 'locating' ? 'Finding your corner of the world.' : citySearching ? 'Looking up your city.' : 'Finding kitchens worth knowing.'} message={phase === 'locating' ? 'Your browser may ask for location permission. We only look once.' : 'Connecting to our public data sources. This may take a few moments.'} />}
    {phase === 'cities' && !citySearching && message && <DiscoveryStatus kind="empty" title="Let’s try another place." message={message} />}
    {phase === 'error' && <DiscoveryStatus kind="error" title="A small detour." message={message} onRetry={area ? () => void searchArea(area) : undefined} />}
    {phase === 'empty' && <DiscoveryStatus kind="empty" title="No documented kitchens in this search." message={`Our sources have no matching restaurants within ${radius} km here. Coverage varies; try a larger radius or another city.`} onExpand={radius < 25 ? () => changeRadius(25) : undefined} />}
    {phase === 'ready' && area && <><p className="discovery-results-context">{restaurants.length} kitchens within {radius} km · {area.label}</p><RestaurantCarousel key={`${area.label}:${radius}`} restaurants={restaurants} basis={area.basis} /></>}
    <footer className="discovery-sources"><p>Places: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors, ODbL</a> · City search: <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">Photon</a>. Stories and photographs carry their own sources.</p><p>Community coverage varies. Map tags are not an award or quality guarantee.</p></footer>
  </section>
}
