import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { divIcon, latLngBounds, map as createMap, marker, tileLayer, LayerGroup, type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './foodmap.css'
import { ArrowUpRight, Bookmark, Check, ChevronDown, ChevronRight, Compass, Crosshair, ExternalLink, ForkKnife, LoaderCircle, MapPin, Menu, Plus, Search, SlidersHorizontal, Star, Users, UtensilsCrossed, X } from 'lucide-react'
import { api } from './api'
import type { FriendsResponse, Privacy, Restaurant, User } from './types'
import { AuthPanel, FriendsPanel, ProfilePanel } from './SocialPanels'

const CITY = { lat: 19.076, lng: 72.8777 }
type Scope = 'all' | 'friends' | 'saved' | 'passport'
type DiscoverHit = Pick<Restaurant, 'id' | 'name' | 'cuisine' | 'address' | 'lat' | 'lng' | 'sourceUrl' | 'source'>

function todayDate(date: string) {
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
function Rating({ value, size = 14 }: { value: number | null; size?: number }) {
  return value === null ? <span className="fm-rating-new">Be the first to visit</span> : <span className="fm-rating"><Star size={size} fill="currentColor"/><strong>{value.toFixed(1)}</strong></span>
}
function Avatar({ user, size = 'normal' }: { user: Pick<User, 'name' | 'avatar'>; size?: string }) {
  return <span className={`fm-avatar ${size}`} aria-label={user.name}>{user.avatar ? <img src={user.avatar} alt="" /> : user.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
}
function StarsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <fieldset className="fm-star-picker"><legend>Your rating</legend><div>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} aria-pressed={value === n} onClick={() => onChange(n)} className={n <= value ? 'chosen' : ''}><Star size={29} fill={n <= value ? 'currentColor' : 'none'}/></button>)}</div></fieldset>
}

export default function FoodMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const authDialog = useRef<HTMLDialogElement>(null)
  const reviewDialog = useRef<HTMLDialogElement>(null)
  const leafletMap = useRef<LeafletMap | null>(null)
  const markerLayer = useRef<import('leaflet').LayerGroup | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<DiscoverHit[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchBusy, setSearchBusy] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [panel, setPanel] = useState<'friends' | 'profile' | null>(null)
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [mapProfileId, setMapProfileId] = useState<string | undefined>()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ photos: false, highRated: false })
  const [collapsed, setCollapsed] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewStars, setReviewStars] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [dishes, setDishes] = useState('')
  const [price, setPrice] = useState('')
  const [visibility, setVisibility] = useState<Privacy>('friends')
  const [photoData, setPhotoData] = useState<string[]>([])
  const [reviewSaving, setReviewSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [friends, setFriends] = useState<FriendsResponse['friends']>([])
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [geolocated, setGeolocated] = useState(false)
  const currentRestaurants = useRef({ visibleRestaurants: [] as Restaurant[], scope, mapProfileId, user, loadRestaurants: async (_map: LeafletMap, _scope: Scope, _profileId?: string) => {} })

  useEffect(() => {
    const title = document.title
    document.title = 'Foodfolk — Good food, remembered'
    return () => { document.title = title }
  }, [])

  useEffect(() => {
    const dialog = authDialog.current
    if (!dialog) return
    if (authOpen && !dialog.open) dialog.showModal()
    if (!authOpen && dialog.open) dialog.close()
  }, [authOpen])

  useEffect(() => {
    const dialog = reviewDialog.current
    if (!dialog) return
    if (reviewOpen && !dialog.open) dialog.showModal()
    if (!reviewOpen && dialog.open) dialog.close()
  }, [reviewOpen])

  const loadRestaurants = useCallback(async (map: LeafletMap, currentScope: Scope, profileId?: string) => {
    const b = map.getBounds()
    const center = map.getCenter()
    const radius = Math.min(15, Math.max(1, (Math.abs(b.getNorth() - b.getSouth()) + Math.abs(b.getEast() - b.getWest())) * 111 / 2))
    const params = new URLSearchParams({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','), center: `${center.lat},${center.lng}`, radius: String(radius), scope: currentScope })
    if (profileId) params.set('userId', profileId)
    const payload = await api<{ restaurants: Restaurant[] }>(`/api/restaurants?${params}`)
    setRestaurants(payload.restaurants)
    setSelected(current => {
      if (!current) return current
      const next = payload.restaurants.find(item => item.id === current.id)
      if (!next || (current.saved === next.saved && current.reviews.length === next.reviews.length && current.rating === next.rating)) return current
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    api<{ user: User | null }>('/api/session').then(({ user: found }) => {
      if (!cancelled) { setUser(found); if (found) setVisibility(found.defaultVisibility) }
    }).catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!mapContainer.current || leafletMap.current) return
    const m = createMap(mapContainer.current, { center: [CITY.lat, CITY.lng], zoom: 13, zoomControl: false, scrollWheelZoom: true, preferCanvas: true })
    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, crossOrigin: 'anonymous' }).addTo(m)
    markerLayer.current = new LayerGroup().addTo(m)
    leafletMap.current = m
    let debounce = 0
    const refresh = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        setBusy(true); setError('')
        void loadRestaurants(m, scope, scope === 'passport' ? mapProfileId || user?.id : undefined).catch(err => setError(err.message)).finally(() => setBusy(false))
      }, 240)
    }
    m.on('moveend', refresh)
    refresh()
    const invalidate = () => m.invalidateSize({ pan: false })
    const observer = new ResizeObserver(invalidate)
    observer.observe(mapContainer.current)
    return () => { window.clearTimeout(debounce); observer.disconnect(); m.off('moveend', refresh); m.remove(); leafletMap.current = null }
    // The map is mounted once; loadRestaurants and scope have separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = leafletMap.current
    if (!m) return
    setBusy(true); setError('')
    loadRestaurants(m, scope, scope === 'passport' ? mapProfileId || user?.id : undefined).catch(err => setError(err.message)).finally(() => setBusy(false))
  }, [scope, user, mapProfileId, loadRestaurants])

  const visibleRestaurants = useMemo(() => restaurants.filter(r => (!filters.photos || r.reviews.some(review => review.photos.length)) && (!filters.highRated || (r.rating ?? 0) >= 4)), [restaurants, filters])
  currentRestaurants.current = { visibleRestaurants, scope, mapProfileId, user, loadRestaurants }

  useEffect(() => {
    const group = markerLayer.current
    const m = leafletMap.current
    if (!group || !m) return
    group.clearLayers()
    if (!visibleRestaurants.length) return
    // Grid grouping is recomputed at each zoom. A grouped pin displays real friend and rating counts.
    const points = visibleRestaurants.map(restaurant => ({ restaurant, point: m.project([restaurant.lat, restaurant.lng], m.getZoom()) }))
    const cells = new Map<string, typeof points>()
    for (const point of points) {
      const cell = `${Math.floor(point.point.x / 62)}:${Math.floor(point.point.y / 62)}`
      cells.set(cell, [...(cells.get(cell) ?? []), point])
    }
    const icon = (html: string, className: string, size: [number, number]) => divIcon({ className, html, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] })
    for (const cluster of cells.values()) {
      if (cluster.length > 1) {
        const [cx, cy] = cluster.reduce(([x, y], item) => [x + item.point.x / cluster.length, y + item.point.y / cluster.length], [0, 0])
        const friendsN = cluster.reduce((n, item) => n + item.restaurant.friendCount, 0)
        const average = cluster.map(x => x.restaurant.rating).filter((n): n is number => n !== null)
        const clusterIcon = marker(m.unproject([cx, cy]), { icon: icon(`<span class="fm-cluster-number">${cluster.length}</span><small>${friendsN ? `${friendsN} friends` : `${average.length ? (average.reduce((a,b) => a+b,0)/average.length).toFixed(1) + ' avg' : 'explore'}`}</small>`, 'fm-cluster', [74, 72]) })
        clusterIcon.on('click', () => {
          if (m.getZoom() < 18) m.fitBounds(latLngBounds(cluster.map(x => [x.restaurant.lat, x.restaurant.lng] as [number, number])), { padding: [70, 70], maxZoom: m.getZoom() + 3 })
          else setSelected(cluster[0].restaurant)
        })
        group.addLayer(clusterIcon)
        continue
      }
      const r = cluster[0].restaurant
      const reviewed = r.friendCount > 0
      const score = r.rating === null ? '✦' : r.rating.toFixed(1)
      const firstReview = r.reviews[0]
      const html = reviewed && firstReview ? `<span class="fm-pin-avatar-initials">${firstReview.user.name.split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase()}</span><strong>${score}</strong>` : `<span class="fm-pin-utensils">✦</span><strong>${score}</strong>`
      const pointIcon = marker([r.lat, r.lng], { icon: icon(html, `fm-map-marker${reviewed ? ' is-social' : ''}${selected?.id === r.id ? ' is-active' : ''}`, [54, 58]), keyboard: true, title: `${r.name}${reviewed ? `, ${r.friendCount} friends reviewed` : ''}` })
      pointIcon.on('click', () => { setSelected(r); setMobileExpanded(false) })
      group.addLayer(pointIcon)
    }
  }, [visibleRestaurants, selected])

  const selectedId = selected?.id
  useEffect(() => {
    const m = leafletMap.current
    if (!m || !selectedId) return
    const live = currentRestaurants.current.visibleRestaurants.find(r => r.id === selectedId)
    api<{ restaurant: Restaurant }>(`/api/restaurants/${encodeURIComponent(selectedId)}`).then(({ restaurant }) => {
      setSelected(restaurant)
      if (live && (restaurant.saved !== live.saved || restaurant.reviews.length !== live.reviews.length)) { const state = currentRestaurants.current; void state.loadRestaurants(m, state.scope, state.scope === 'passport' ? state.mapProfileId || state.user?.id : undefined).catch(() => {}) }
    }).catch(err => setError(err.message))
  }, [selectedId]) // fetch detail once when the selected restaurant changes

  useEffect(() => {
    if (!user) { setFriends([]); return }
    let active = true
    api<FriendsResponse>('/api/friends').then(data => { if (active) setFriends(data.friends) }).catch(() => {})
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!query.trim()) { setSearchHits([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchBusy(true)
      try { const data = await api<{ restaurants: DiscoverHit[] }>(`/api/restaurants/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal }); setSearchHits(data.restaurants) }
      catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Search failed. Please try again.') }
      finally { if (!controller.signal.aborted) setSearchBusy(false) }
    }, 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

  const signOut = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); setUser(null); setPanel(null); setScope('all'); setSelected(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out.') }
  }

  const moveTo = (lat: number, lng: number, zoom = 16) => {
    leafletMap.current?.flyTo([lat, lng], zoom, { duration: .7 })
    setSearchOpen(false)
    setQuery('')
  }

  const locate = () => {
    if (!navigator.geolocation) { setNotice('Location isn’t available in this browser.'); return }
    navigator.geolocation.getCurrentPosition(pos => {
      if (Date.now() - pos.timestamp > 10000) { setNotice('Your location update expired. Try again.'); return }
      moveTo(pos.coords.latitude, pos.coords.longitude, 16)
      setGeolocated(true)
      setNotice('Showing nearby places. Your location isn’t saved or shared.')
    }, () => setNotice('Location permission was not granted. Search for a neighbourhood instead.'), { maximumAge: 0, timeout: 12000, enableHighAccuracy: false })
  }

  const selectSearchResult = async (hit: DiscoverHit) => {
    moveTo(hit.lat, hit.lng, 17)
    setSearchBusy(true)
    try {
      const { restaurant } = await api<{ restaurant: Restaurant }>(`/api/restaurants/${encodeURIComponent(hit.id)}`)
      setSelected(restaurant)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open this restaurant.') }
    finally { setSearchBusy(false) }
  }

  const toggleSaved = async (restaurant: Restaurant) => {
    if (!user) { setAuthOpen(true); return }
    const previous = restaurant.saved
    setSelected({ ...restaurant, saved: !previous })
    setRestaurants(old => old.map(r => r.id === restaurant.id ? { ...r, saved: !previous } : r))
    try {
      await api(`/api/saved/${encodeURIComponent(restaurant.id)}`, { method: previous ? 'DELETE' : 'POST' })
      setNotice(previous ? 'Removed from your saved places.' : 'Saved to your food passport.')
    } catch (err) {
      setSelected({ ...restaurant, saved: previous }); setRestaurants(old => old.map(r => r.id === restaurant.id ? { ...r, saved: previous } : r))
      setError(err instanceof Error ? err.message : 'Could not update saved places.')
    }
  }

  const handlePhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])].slice(0, 4 - photoData.length)
    for (const file of files) {
      if (!file.type.startsWith('image/')) { setError(`${file.name} is not an image.`); continue }
      if (file.size > 9 * 1024 * 1024) { setError(`${file.name} is larger than 9 MB.`); continue }
      try {
        const image = await createImageBitmap(file)
        const scale = Math.min(1, 1440 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
        image.close()
        photoData.push(canvas.toDataURL('image/jpeg', .84))
      } catch { setError(`Could not read ${file.name}. Please try another photo.`) }
    }
    setPhotoData([...photoData]); event.currentTarget.value = ''
  }

  const submitReview = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !selected) return
    if (reviewBody.trim().length < 12) { setError('Add a little more detail so your review helps someone decide.'); return }
    setReviewSaving(true); setError('')
    try {
      const photoIds: string[] = []
      for (const data of photoData) {
        const uploaded = await api<{ id: string }>('/api/photos', { method: 'POST', body: JSON.stringify({ data }) })
        photoIds.push(uploaded.id)
      }
      await api('/api/reviews', { method: 'POST', body: JSON.stringify({ restaurantId: selected.id, rating: reviewStars, body: reviewBody.trim(), dishes: dishes.split(',').map(x => x.trim()).filter(Boolean).slice(0, 8), price: price || null, visibility, photoIds }) })
      const { restaurant } = await api<{ restaurant: Restaurant }>(`/api/restaurants/${encodeURIComponent(selected.id)}`)
      setSelected(restaurant); setRestaurants(old => old.map(r => r.id === restaurant.id ? restaurant : r))
      setReviewOpen(false); setReviewBody(''); setDishes(''); setPrice(''); setPhotoData([]); setNotice('Your review is live. Thanks for sharing!')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not publish your review. Please try again.') }
    finally { setReviewSaving(false) }
  }

  const refresh = () => {
    const m = leafletMap.current
    if (m) { setBusy(true); loadRestaurants(m, scope, scope === 'passport' ? mapProfileId || user?.id : undefined).catch(err => setError(err.message)).finally(() => setBusy(false)) }
  }

  const directions = (r: Restaurant) => {
    const url = `https://www.openstreetmap.org/directions?to=${r.lat}%2C${r.lng}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const selectProfile = async (person: User) => {
    setPanel(null)
    try { const { user: full } = await api<{ user: User }>(`/api/users/${encodeURIComponent(person.id)}`); setProfileUser(full) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not open this profile.') }
  }

  const closeAll = () => { setSelected(null); setReviewOpen(false); setPanel(null); setProfileUser(null); setAuthOpen(false) }
  const handleSearchKey = (event: ReactKeyboardEvent<HTMLInputElement>) => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && searchHits[0]) { event.preventDefault(); void selectSearchResult(searchHits[0]) } }

  return <main className="foodmap-page" aria-label="Food Map">
    <div className="fm-experience">
      <header className="fm-header">
        <a className="fm-brand" href="/" aria-label="Cook Along home"><span className="fm-brand-icon"><ForkKnife size={19}/></span><span>food<span>folk</span></span></a>
        <div className="fm-location"><span className="fm-location-dot"/><span>MUMBAI <i>·</i> MAHARASHTRA</span><ChevronDown size={14}/></div>
        <div className="fm-header-actions"><button className="fm-header-help" aria-label="Search for people and restaurants" onClick={() => { setSearchOpen(true); document.querySelector<HTMLInputElement>('.fm-search-input')?.focus() }}><Search size={17}/><span>Explore your people & places</span></button>{user ? <button className="fm-header-avatar" aria-label={`Open ${user.name}'s food passport`} onClick={() => setPanel('profile')}><Avatar user={user}/></button> : <button className="fm-header-signin" onClick={() => setAuthOpen(true)}>Sign in <ArrowUpRight size={15}/></button>}</div>
      </header>
      <div className="fm-workspace">
        <aside className={`fm-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Explore food map">
          <button className="fm-sidebar-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(v => !v)}><Menu size={17}/><ChevronRight size={14}/></button>
          {!collapsed && <>
            <div className="fm-sidebar-kicker">YOUR TABLE, EVERYWHERE</div><h1>Find your<br/>next <span>favourite.</span></h1>
            <p className="fm-sidebar-intro">A living food map from the people who know your taste.</p>
            <div className="fm-friend-strip"><div className="fm-friend-overlap">{friends.slice(0, 4).map(friend => <button key={friend.id} aria-label={`View ${friend.name}'s profile`} onClick={() => void selectProfile(friend)}><Avatar user={friend}/></button>)}{!friends.length && <Users size={17}/>}</div><span>{friends.length ? <><b>{friends.length}</b> at your table</> : 'Food is better together'}<button onClick={() => user ? setPanel('friends') : setAuthOpen(true)}>{friends.length ? 'Manage' : 'Find friends'} <ChevronRight size={13}/></button></span></div>
            <div className="fm-discover-nav" role="tablist" aria-label="Place collections">{([{ key:'all', label:'All places', icon:Compass }, { key:'friends', label:'From friends', icon:Users }, { key:'saved', label:'Saved places', icon:Bookmark }, { key:'passport', label:'Food passport', icon:MapPin }] as const).map(({ key, label, icon:Icon }) => <button role="tab" aria-selected={scope === key} key={key} onClick={() => { if ((key === 'saved' || key === 'friends' || key === 'passport') && !user) { setAuthOpen(true); return } setScope(key); setMobileExpanded(false) }}><Icon size={17}/><span>{label}</span>{key === 'saved' && user && <small>{user.savedCount}</small>}{key === 'friends' && <small>{friends.length}</small>}</button>)}</div>
            <div className="fm-sidebar-bottom"><span className="fm-social-proof"><span>“</span> A little local knowledge<br/>changes everything.</span><a target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/copyright">Thoughtfully mapped <ExternalLink size={12}/></a></div>
          </>}
        </aside>
        <section className="fm-map-area" aria-label="Restaurant map and discovery">
          <div ref={mapContainer} className="fm-map-canvas" aria-label="Interactive restaurant map. Use the map controls to zoom and drag to explore." />
          <div className="fm-map-masthead" aria-hidden="true"><span>THE GOOD TASTE MAP</span><i/><span>EST. WITH FRIENDS</span></div>
          <div className="fm-map-search-wrap"><form className={`fm-search${searchOpen ? ' is-open' : ''}`} onSubmit={e => { e.preventDefault(); if (searchHits[0]) void selectSearchResult(searchHits[0]) }}><Search size={19}/><input className="fm-search-input" value={query} onFocus={() => { setSearchOpen(true); setPanel(null) }} onKeyDown={handleSearchKey} onChange={e => setQuery(e.target.value)} placeholder="Dish, place, or neighbourhood" aria-label="Search restaurants and neighbourhoods" /><kbd>⌘ K</kbd>{query && <button type="button" className="fm-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</form>
            {searchOpen && query.trim().length > 1 && <div className="fm-search-results" role="listbox" aria-label="Restaurant search results">{searchBusy ? <p className="fm-search-feedback"><LoaderCircle className="fm-spin" size={17}/>Finding good places…</p> : searchHits.length ? searchHits.slice(0, 6).map(hit => <button key={hit.id} role="option" aria-selected={false} onClick={() => void selectSearchResult(hit)}><span className="fm-result-icon"><MapPin size={17}/></span><span><b>{hit.name}</b><small>{hit.cuisine || 'Restaurant'} {hit.address && `· ${hit.address}`}</small></span><ArrowUpRight size={15}/></button>) : <p className="fm-search-feedback">No restaurants found yet. Try a dish or a different area.</p>}</div>}
          </div>
          <div className="fm-map-toolbar"><div className="fm-filter-wrap"><button className={`fm-map-control fm-filter-button${filtersOpen ? ' is-active' : ''}`} onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen}><SlidersHorizontal size={16}/> Filters{Object.values(filters).filter(Boolean).length > 0 && <span className="fm-filter-dot"/>}</button>{filtersOpen && <div className="fm-filter-popover"><strong>Show me</strong><label><input type="checkbox" checked={filters.photos} onChange={e => setFilters(v => ({ ...v, photos: e.target.checked }))}/>Places with food photos</label><label><input type="checkbox" checked={filters.highRated} onChange={e => setFilters(v => ({ ...v, highRated: e.target.checked }))}/>Rated four stars or more</label><button onClick={() => { setFilters({ photos: false, highRated: false }); setFiltersOpen(false) }}>Clear filters</button></div>}</div>{scope !== 'all' && <button className="fm-map-control fm-scope-label" onClick={() => setScope('all')}>{scope === 'friends' ? <Users size={15}/> : scope === 'saved' ? <Bookmark size={15}/> : <MapPin size={15}/>} {scope === 'friends' ? 'From friends' : scope === 'saved' ? 'Saved' : 'Your passport'} <X size={13}/></button>}</div>
          <div className="fm-map-location"><button aria-label="Go to your current location" onClick={locate} className={geolocated ? 'is-active' : ''}><Crosshair size={17}/></button><span>{geolocated ? 'NEAR YOU' : 'SOUTH MUMBAI'} <i>·</i> {leafletMap.current?.getZoom() ?? 13}X</span></div>
          <div className="fm-zoom-controls" aria-label="Map zoom controls"><button aria-label="Zoom in" onClick={() => leafletMap.current?.zoomIn()}><Plus size={18}/></button><button aria-label="Zoom out" onClick={() => leafletMap.current?.zoomOut()}><span>−</span></button></div>
          <button className="fm-attribution-hint" aria-label="Map attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></button>
          {error && <div className="fm-map-toast fm-error-toast" role="alert"><span>{error}</span><button onClick={() => { setError(''); refresh() }}>Try again <ArrowUpRight size={14}/></button><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15}/></button></div>}
          {notice && <button className="fm-map-toast" onClick={() => setNotice('')}><Check size={16}/>{notice}<X size={14}/></button>}
          <div className={`fm-explore-tray${mobileExpanded ? ' is-expanded' : ''}${selected ? ' has-detail' : ''}`}>
            <button className="fm-tray-handle" onClick={() => setMobileExpanded(v => !v)} aria-label={mobileExpanded ? 'Collapse restaurant list' : 'Expand restaurant list'}><span/></button>
            <div className="fm-tray-heading"><div><div className="fm-tray-eyebrow">{scope === 'all' ? 'THE CITY, ON A PLATE' : scope === 'friends' ? 'TASTES YOU TRUST' : scope === 'saved' ? 'FOR ANOTHER DAY' : 'YOUR FOOD PASSPORT'}</div><h2>{scope === 'all' ? 'A good place to start.' : scope === 'friends' ? 'Your people’s picks.' : scope === 'saved' ? 'One day, very soon.' : 'Every meal, remembered.'}</h2></div><button className="fm-tray-toggle" aria-label={mobileExpanded ? 'Show selected place' : 'Show more places'} onClick={() => setMobileExpanded(v => !v)}><ChevronDown size={17}/></button></div>
            {busy && <div className="fm-inline-loading"><LoaderCircle className="fm-spin" size={17}/> Gathering the good spots…</div>}
            {!busy && !visibleRestaurants.length && <div className="fm-explore-empty"><span className="fm-empty-icon"><UtensilsCrossed size={22}/></span><p>{scope === 'friends' ? 'Your friends’ table is still empty.' : scope === 'saved' ? 'A blank slate for your next adventure.' : scope === 'passport' ? 'Your first food memory is waiting.' : 'No restaurants on this little stretch yet.'}</p><span>{scope === 'friends' ? 'Find a few people with delicious taste.' : scope === 'saved' || scope === 'passport' ? 'Save a restaurant or share a review to begin.' : 'Search by restaurant or move the map a little.'}</span><button onClick={() => scope === 'friends' ? (user ? setPanel('friends') : setAuthOpen(true)) : scope !== 'all' ? setScope('all') : (setSearchOpen(true), document.querySelector<HTMLInputElement>('.fm-search-input')?.focus())}>{scope === 'friends' ? 'Find your people' : scope !== 'all' ? 'Explore restaurants' : 'Search the map'} <ArrowUpRight size={15}/></button></div>}
            {!busy && visibleRestaurants.length > 0 && <div className="fm-place-list">{visibleRestaurants.slice(0, 12).map(r => <button className={`fm-place-row${r.id === selected?.id ? ' is-selected' : ''}`} key={r.id} onClick={() => { setSelected(r); setMobileExpanded(false) }}><span className={`fm-row-pin${r.friendCount > 0 ? ' is-social' : ''}`}><ForkKnife size={15}/></span><span className="fm-place-copy"><b>{r.name}</b><small>{r.cuisine || 'A local favourite'} {r.address && `· ${r.address.split(',')[0]}`}</small><span className="fm-place-friends">{r.friendCount ? `${r.friendCount} ${r.friendCount === 1 ? 'friend' : 'friends'} recommend` : r.rating ? `${r.reviewCount} ${r.reviewCount === 1 ? 'local review' : 'local reviews'}` : 'Ready for your first visit'}<Rating value={r.rating} size={12}/></span></span><ChevronRight size={16}/></button>)}</div>}
            <footer className="fm-tray-footer"><span>{visibleRestaurants.length} good places in view</span><span className="fm-openstreetmap-brand">MAPPED WITH CARE <span>·</span> OPENSTREETMAP</span></footer>
          </div>
        </section>
        {panel && <aside className="fm-social-drawer" aria-label={panel === 'friends' ? 'Friends' : 'Your food passport'}><button className="fm-drawer-close" aria-label="Close panel" onClick={() => setPanel(null)}><X size={18}/></button>{panel === 'friends' ? user && <FriendsPanel user={user} onProfile={person => void selectProfile(person)} onChanged={refresh}/> : user && <ProfilePanel user={user} onUpdated={setUser} onLogout={() => void signOut()}/>}</aside>}
      </div>
      {selected && <section className="fm-detail-backdrop" aria-label={`${selected.name} restaurant details`} onMouseDown={event => { if (event.target === event.currentTarget) closeAll() }}><article className="fm-detail-sheet"><button className="fm-detail-close" aria-label="Close restaurant details" onClick={() => setSelected(null)}><X size={19}/></button><div className="fm-detail-photo"><span className="fm-detail-photo-label"><MapPin size={13}/> {selected.address || 'MUMBAI'}</span><div className="fm-detail-photo-word" aria-hidden="true">GOOD<br/>TASTE<br/><span>↑</span></div><button className={`fm-detail-save${selected.saved ? ' is-saved' : ''}`} aria-label={selected.saved ? 'Remove saved restaurant' : 'Save restaurant'} onClick={() => void toggleSaved(selected)}><Bookmark size={17} fill={selected.saved ? 'currentColor' : 'none'}/></button></div><div className="fm-detail-content"><div className="fm-detail-heading"><div><span className="fm-detail-cuisine">{selected.cuisine || 'A table worth finding'}</span><h2>{selected.name}</h2><p>{selected.address || 'Mumbai, Maharashtra'}</p></div><Rating value={selected.rating} size={17}/></div><div className="fm-detail-social"><div className="fm-detail-avatars">{selected.reviews.slice(0, 3).map(review => <button key={review.id} aria-label={`View ${review.user.name}'s review`} onClick={() => { const person = { id: review.user.id, name: review.user.name, username: review.user.username, avatar: null, discoverable: true, defaultVisibility: 'friends' as Privacy, reviewCount: 0, savedCount: 0 }; void selectProfile(person) }}><Avatar user={{ ...review.user, avatar: null }}/></button>)}</div><p>{selected.friendCount ? <><b>{selected.friendCount} {selected.friendCount === 1 ? 'friend' : 'friends'} love this spot.</b><span> A recommendation with good company.</span></> : <><b>No friend notes yet.</b><span> Go first. They’ll thank you later.</span></>}</p></div><button className="fm-directions" onClick={() => directions(selected)}><span><ArrowUpRight size={18}/></span><span><b>Make your way here</b><small>Get directions with OpenStreetMap</small></span><ExternalLink size={15}/></button>
        {user && <button className="fm-write-review" onClick={() => { setError(''); setReviewOpen(true) }}>Share your visit <ArrowUpRight size={17}/></button>}
        {!user && <button className="fm-write-review" onClick={() => setAuthOpen(true)}>Add a restaurant review <ArrowUpRight size={17}/></button>}
        <div className="fm-reviews-heading"><h3>Around the table</h3><span>{selected.reviews.length} {selected.reviews.length === 1 ? 'review' : 'reviews'}</span></div>
        <div className="fm-reviews-list">{selected.reviews.slice(0, 10).map(review => <article className="fm-review" key={review.id}><button className="fm-review-user" onClick={() => { const person = { id: review.user.id, name: review.user.name, username: review.user.username, avatar: null, discoverable: true, defaultVisibility: 'friends' as Privacy, reviewCount: 0, savedCount: 0 }; void selectProfile(person) }}><Avatar user={{ ...review.user, avatar: null }}/><span><b>{review.user.name}</b><small>@{review.user.username} · {todayDate(review.createdAt)}</small></span><span className="fm-review-rating"><Star size={12} fill="currentColor"/>{review.rating}</span></button><p>{review.body}</p>{review.dishes.length > 0 && <div className="fm-dish-chips">{review.dishes.map(dish => <span key={dish}>{dish}</span>)}</div>}{review.price && <small className="fm-review-price">ABOUT ₹{review.price} FOR TWO</small>}{review.photos.length > 0 && <div className="fm-review-photos">{review.photos.map((src, index) => <img key={src} src={src} alt={`Food photo ${index + 1} from ${review.user.name}'s review`} loading="lazy"/>)}</div>}</article>)}</div>
        {selected.reviews.length === 0 && <p className="fm-no-reviews">No notes from the neighbourhood yet.<br/>You can be the person who starts the story.</p>}
        <a className="fm-open-data" href={selected.sourceUrl} target="_blank" rel="noreferrer">Restaurant details © OpenStreetMap contributors <ExternalLink size={13}/></a>
      </div></article></section>}
      {authOpen && <dialog ref={authDialog} className="fm-modal" aria-label="Sign in or create a food passport" onCancel={() => setAuthOpen(false)} onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false) }}><button className="fm-modal-close" aria-label="Close" onClick={() => setAuthOpen(false)}><X size={18}/></button><AuthPanel onClose={() => setAuthOpen(false)} onSuccess={found => { setUser(found); setVisibility(found.defaultVisibility); setAuthOpen(false); setNotice(`Welcome to the table, ${found.name.split(' ')[0]}.`) }}/></dialog>}
      {reviewOpen && selected && <dialog ref={reviewDialog} className="fm-modal fm-review-modal" aria-label={`Review ${selected.name}`} onCancel={() => setReviewOpen(false)} onMouseDown={event => { if (event.target === event.currentTarget) setReviewOpen(false) }}><button className="fm-modal-close" aria-label="Close review form" onClick={() => setReviewOpen(false)}><X size={18}/></button><form className="fm-review-form" onSubmit={submitReview}><span className="fm-review-label">TELL US ABOUT YOUR VISIT</span><h2>Your table,<br/><span>your story.</span></h2><p className="fm-review-for">A review for <strong>{selected.name}</strong></p><StarsInput value={reviewStars} onChange={setReviewStars}/><label className="fm-form-label" htmlFor="fm-review-text">What made the meal memorable?</label><textarea id="fm-review-text" value={reviewBody} maxLength={1200} minLength={12} onChange={e => setReviewBody(e.target.value)} placeholder="Tell your friends what to expect…" required/><span className="fm-review-char-count">{reviewBody.length}/1,200</span><label className="fm-form-label" htmlFor="fm-review-dishes">What should they order?</label><input id="fm-review-dishes" value={dishes} onChange={e => setDishes(e.target.value)} placeholder="Butter garlic crab, daulat ki chaat…"/><div className="fm-review-two"><label><span className="fm-form-label">Price for two <small>₹</small></span><input inputMode="numeric" type="number" min="0" max="500000" value={price} onChange={e => setPrice(e.target.value)}/></label><label><span className="fm-form-label">Who can see this?</span><select value={visibility} onChange={e => setVisibility(e.target.value as Privacy)}><option value="friends">My friends</option><option value="public">Everyone</option><option value="private">Only me</option></select></label></div><label className="fm-photo-button"><Plus size={17}/><span>ADD FOOD PHOTOS</span><small>{photoData.length}/4</small><input aria-label="Add food photos" type="file" accept="image/*" multiple onChange={e => void handlePhotos(e)}/></label>{photoData.length > 0 && <div className="fm-photo-strip">{photoData.map((src, i) => <span key={src}><img src={src} alt={`Upload preview ${i + 1}`}/><button aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotoData(old => old.filter((_, index) => index !== i))}><X size={13}/></button></span>)}</div>}{error && <p className="fm-error fm-form-error" role="alert">{error}</p>}<button disabled={reviewSaving} className="fm-button fm-primary fm-publish">{reviewSaving ? <><LoaderCircle className="fm-spin" size={17}/> Saving your story…</> : <>Publish your review <ArrowUpRight size={17}/></>}</button><p className="fm-review-privacy">Your exact location is never shared. Your review is visible to your chosen audience.</p></form></dialog>}
      {profileUser && <section className="fm-detail-backdrop" aria-label={`${profileUser.name}'s food passport`} onMouseDown={event => { if (event.target === event.currentTarget) setProfileUser(null) }}><article className="fm-profile-sheet"><button className="fm-detail-close" aria-label="Close food passport" onClick={() => setProfileUser(null)}><X size={19}/></button><div className="fm-profile-hero"><Avatar user={profileUser} size="fm-profile-avatar"/><div><span>THEIR FOOD PASSPORT</span><h2>{profileUser.name}</h2><p>@{profileUser.username}</p></div></div><div className="fm-profile-stats"><span><b>{profileUser.reviewCount}</b> places tried</span><span><b>{profileUser.savedCount}</b> on the wish list</span></div><p className="fm-profile-map-label">THE RESTAURANTS THAT MAKE THEIR MAP</p><button className="fm-profile-map-link" onClick={() => { setProfileUser(null); setMapProfileId(profileUser.id); setScope('passport'); moveTo(CITY.lat, CITY.lng) }}><MapPin size={17}/>Explore their restaurants <ChevronRight size={16}/></button></article></section>}
      {panel && <button className="fm-mobile-overlay" aria-label="Close navigation" onClick={() => setPanel(null)}/>}
    </div>
  </main>
}
