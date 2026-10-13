import { useEffect, useId, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, MapPin, Utensils } from 'lucide-react'
import { loadRestaurantDetail } from './data'
import type { Restaurant, RestaurantDetail } from './types'
import RecipeArt from '../RecipeArt'
import ImageTone from '../ImageTone'

export function CulinaryFact({ fact, signatureDish }: Pick<RestaurantDetail, 'fact' | 'signatureDish'>) {
  return <div className="culinary-fact"><p className="editorial-label">{fact.kind === 'editorial' ? 'THE STORY BEHIND THE PLATE' : fact.kind === 'encyclopedia' ? 'A LITTLE BACKGROUND' : 'FROM THE LOCAL MAP'}</p><p className="culinary-fact-text">{fact.text}</p>{signatureDish && <p className="signature-dish"><strong>A signature to know</strong>{signatureDish}</p>}<a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">{fact.sourceLabel} <ExternalLink size={14} /><span className="sr-only"> (opens in a new tab)</span></a>{fact.kind === 'encyclopedia' && <p className="discovery-license">Shortened excerpt from Wikipedia contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></p>}</div>
}

function RestaurantSpotlight({ restaurant, basis }: { restaurant: Restaurant; basis: 'device' | 'city' }) {
  const toneId = `restaurant-tone-${useId().replaceAll(':', '')}`
  const [detail, setDetail] = useState<RestaurantDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    loadRestaurantDetail(restaurant, controller.signal).then(setDetail).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [restaurant])
  const photo = !imageFailed ? detail?.photo : undefined
  return <article className="restaurant-spotlight" aria-label={restaurant.name}>
    <svg className="image-tone-defs" aria-hidden="true" width="0" height="0"><defs><filter id={toneId} colorInterpolationFilters="sRGB"><ImageTone /></filter></defs></svg>
    <figure className={`restaurant-photo ${photo ? '' : 'restaurant-photo-art'}`}>
      {photo ? <img style={{ filter: `url(#${toneId})` }} src={photo.url} alt={photo.alt} onError={() => setImageFailed(true)} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <div className="restaurant-photo-placeholder"><div aria-hidden="true"><RecipeArt /></div><p><Utensils size={22} /> A kitchen<br />worth knowing.</p></div>}
      <figcaption>{photo ? <><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">Photo: {photo.credit}</a><span> · </span><a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a><span> · cropped & color-toned</span></> : detail || failed ? 'Editorial illustration · restaurant photography not available from our licensed sources.' : 'Finding the story and licensed photography…'}</figcaption>
    </figure>
    <div className="restaurant-story">
      <div className="restaurant-kicker"><span>{restaurant.fineDining ? 'FINE-DINING MAP PICK' : 'A DOCUMENTED LOCAL KITCHEN'}</span><span><MapPin size={14} /> Approx. {restaurant.distanceKm < 0.1 ? '< 0.1' : restaurant.distanceKm.toFixed(1)} km</span></div>
      <h3>{restaurant.name}</h3>
      <p className="restaurant-neighborhood">{restaurant.neighborhood || 'Neighborhood not listed'}{restaurant.cuisine ? ` · ${restaurant.cuisine}` : ''}</p>
      {detail ? <CulinaryFact fact={detail.fact} signatureDish={detail.signatureDish} /> : <div className="culinary-fact" role="status"><p className="editorial-label">{failed ? 'THE MAP IS STILL OPEN' : 'THE STORY BEHIND THE PLATE'}</p><p>{failed ? 'The story service is unavailable. You can still explore this restaurant’s source listing.' : 'Looking for the details that make this kitchen special…'}</p></div>}
      <a className="restaurant-explore primary" href={restaurant.website || restaurant.mapUrl} target="_blank" rel="noopener noreferrer">Explore restaurant <ArrowRight size={22} /><span className="sr-only"> (opens in a new tab)</span></a>
      <p className="restaurant-distance-note">Straight-line distance from {basis === 'city' ? 'your selected city or neighborhood center' : 'your approximate location'}. Check the restaurant’s own site for current menus and opening details.</p>
      <a className="restaurant-map-source" href={restaurant.mapUrl} target="_blank" rel="noopener noreferrer">View source map listing <ExternalLink size={12} /></a>
    </div>
  </article>
}

export function RestaurantCarousel({ restaurants, basis }: { restaurants: Restaurant[]; basis: 'device' | 'city' }) {
  const [index, setIndex] = useState(0)
  const restaurant = restaurants[index] || restaurants[0]
  return <div className="restaurant-carousel" role="region" aria-roledescription="carousel" aria-label="Restaurant stories">
    <div className="restaurant-carousel-heading"><p>Good places. Better stories.</p><div className="restaurant-carousel-controls"><button aria-label="Previous restaurant" onClick={() => setIndex(value => (value - 1 + restaurants.length) % restaurants.length)} disabled={restaurants.length < 2}><ArrowLeft size={22} /></button><span aria-live="polite" aria-atomic="true"><span className="sr-only">{restaurant.name}. Restaurant </span>{String(index + 1).padStart(2, '0')} <span>/ {String(restaurants.length).padStart(2, '0')}</span></span><button aria-label="Next restaurant" onClick={() => setIndex(value => (value + 1) % restaurants.length)} disabled={restaurants.length < 2}><ArrowRight size={22} /></button></div></div>
    <RestaurantSpotlight key={restaurant.id} restaurant={restaurant} basis={basis} />
  </div>
}
