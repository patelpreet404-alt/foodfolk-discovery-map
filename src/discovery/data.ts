import type { City, Point, Restaurant, RestaurantDetail } from './types'
const PHOTON = import.meta.env.VITE_PHOTON_URL || 'https://photon.komoot.io'
const OVERPASS = import.meta.env.VITE_OVERPASS_URL || 'https://overpass-api.de/api/interpreter'
const cache = new Map<string, { expires: number; value: unknown }>()
const stories = [
  { name: 'Core by Clare Smyth', aliases: ['core', 'core by clare smyth'], text: 'Core celebrates British produce and the farmers and food producers who grow it.', region: { lat: 51.515, lon: -0.199 }, signatureDish: 'Potato and roe — dulse beurre blanc, herring and trout roe.', url: 'https://corebyclaresmyth.com/menus/' },
  { name: 'The Table', aliases: ['the table'], text: 'The Colaba restaurant pairs globally inspired sharing plates with produce from its farm in Sasawne, Alibag, established in 2012.', url: 'https://foodmatters.in/the-table/', region: { lat: 18.93, lon: 72.83 } },
  { name: 'Arpège', aliases: ['arpège', 'arpege', "l'arpège"], text: 'Alain Passard announced an entirely plant-based menu from 21 July 2025, with honey remaining part of the kitchen’s ingredients.', region: { lat: 48.855, lon: 2.317 }, url: 'https://www.alain-passard.com/' },
  { name: 'Le Bernardin', aliases: ['le bernardin'], text: 'Le Bernardin opened in New York in 1986, bringing its Paris roots and a focus on seafood.', region: { lat: 40.761, lon: -73.982 }, url: 'https://www.le-bernardin.com/about' },
  { name: 'Odette', aliases: ['odette'], text: 'Julien Royer named Odette after his grandmother in Cantal. The Singapore restaurant brings his modern French approach into conversation with Asia.', region: { lat: 1.29, lon: 103.851 }, url: 'https://odetterestaurant.com/' },
]
const validPoint = (p: Point) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
export function coarsePoint(p: Point): Point { if (!validPoint(p)) throw new Error('Invalid location.'); return { lat: Number(p.lat.toFixed(3)), lon: Number(p.lon.toFixed(3)) } }
export function distanceKm(a: Point, b: Point): number { const rad = Math.PI / 180; const dlat = (b.lat-a.lat)*rad; const dlon=(b.lon-a.lon)*rad; const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2; return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h))) }
export function safeUrl(value: unknown): string | undefined { if(typeof value!=='string') return; try { const u = new URL(value.startsWith('http://') ? value.replace(/^http:/,'https:') : value); if(u.protocol!=='https:' || u.username || u.password) return; return u.href } catch { return } }
function storyFor(r: Restaurant) { return stories.find(s => s.aliases.includes(r.name.toLowerCase().trim()) && (!s.region || distanceKm(s.region,r.point)<30)) }
async function request<T>(key: string, url: string, signal: AbortSignal, init?: RequestInit): Promise<T> {
  signal.throwIfAborted()
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T
  if (!safeUrl(url)) throw new Error('The data provider must use a public HTTPS URL.')
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('The provider took too long to respond. Please try again shortly.', 'TimeoutError')), 20000)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`The data provider returned ${response.status}. Please try again shortly.`)
    const value = await response.json() as T
    const valid = value && typeof value === 'object' && (
      'features' in value && Array.isArray(value.features) ||
      'elements' in value && Array.isArray(value.elements) ||
      'query' in value && value.query && typeof value.query === 'object'
    )
    if (!valid) throw new Error('The data provider returned an unreadable response.')
    // Incomplete Overpass responses must remain retryable, never cached as empty results.
    if ('remark' in value && value.remark) throw new Error('The map service could not finish this search. Please retry or choose a smaller radius.')
    signal.throwIfAborted()
    if (cache.size >= 20) cache.delete(cache.keys().next().value!)
    cache.set(key, { expires: Date.now() + 900000, value })
    return value
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    if (error instanceof TypeError) throw new Error('We could not connect to the restaurant data service. Check your connection and try again shortly.')
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

type PhotonFeature = { properties?: Record<string, unknown>; geometry?: {coordinates?: unknown[]} }
function features(data: unknown): PhotonFeature[] { if(!data || typeof data!=='object' || !Array.isArray((data as {features?:unknown}).features)) throw new Error('The city provider returned an unreadable response.'); return (data as {features:PhotonFeature[]}).features }
export async function searchCities(query: string, signal: AbortSignal): Promise<City[]> {
 const q=query.trim(); if(q.length<2) return []; const data=await request<unknown>(`city:${q.toLowerCase()}`,`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=15`,signal)
 const result:City[]=[]; for(const f of features(data)) { const p=f.properties||{}; const c=f.geometry?.coordinates; if(!['city','town','village','suburb','quarter','neighbourhood'].includes(String(p.osm_value)) || !c || typeof c[0]!=='number'||typeof c[1]!=='number'||typeof p.name!=='string') continue; const point={lat:c[1],lon:c[0]}; if(!validPoint(point)) continue; const label=[...new Set([p.name,p.city,p.state,p.country].filter(x=>typeof x==='string'))].join(', '); if(result.some(x=>x.label===label))continue; result.push({id:`${p.osm_type}:${p.osm_id}`,name:p.name,label,point}); } return result.slice(0,8)
}
export async function reverseArea(point: Point, signal: AbortSignal): Promise<string> { const p=coarsePoint(point); const data=await request<unknown>(`reverse:${p.lat}:${p.lon}`,`${PHOTON}/reverse?lat=${p.lat}&lon=${p.lon}&limit=1`,signal); const props=features(data)[0]?.properties; return props ? [props.city||props.name,props.country].filter(x=>typeof x==='string').join(', ') || 'Your area' : 'Your area' }
type Element = { type?: string; id?: number; lat?: number; lon?: number; center?: Point; tags?: Record<string,string> }
export async function discoverRestaurants(point: Point, radiusKm: number, signal: AbortSignal): Promise<Restaurant[]> {
 if(!Number.isFinite(radiusKm)||radiusKm<1||radiusKm>25)throw new Error('Choose a radius between 1 and 25 km.'); const p=coarsePoint(point); // A bounded indexed scan avoids repeating expensive radial scans on the public service.
 const latDelta = radiusKm / 110.574
 const lonDelta = Math.min(180, radiusKm / (111.32 * Math.max(0.00001, Math.cos(p.lat * Math.PI / 180))))
 const wrap = (lon: number) => ((lon + 540) % 360) - 180
 const bbox = [Math.max(-90, p.lat - latDelta), lonDelta === 180 ? -180 : wrap(p.lon - lonDelta), Math.min(90, p.lat + latDelta), lonDelta === 180 ? 180 : wrap(p.lon + lonDelta)].join(',')
 const named = ['Core by Clare Smyth', 'Core', 'CORE', 'The Table', 'Arpège', 'Arpege', 'Le Bernardin', 'Odette'].map(name => `t["name"]=="${name}"`).join('||')
 const query = `[out:json][timeout:10][maxsize:16777216];nwr(${bbox})[amenity=restaurant](if:is_tag("wikipedia")||is_tag("wikidata")||t["cuisine"]=="fine_dining"||${named});out center tags;`

 const data=await request<{elements?:Element[];remark?:string}>(`near:${p.lat}:${p.lon}:${radiusKm}`,OVERPASS,signal,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}).toString()}); if(data.remark)throw new Error('The map service could not finish this search. Please retry or choose a smaller radius.'); if(!Array.isArray(data.elements))throw new Error('The map provider returned an unreadable response.')
 const results:Restaurant[]=[]; for(const e of data.elements) { const t=Object.fromEntries(Object.entries(e.tags||{}).filter((entry): entry is [string,string] => typeof entry[1] === 'string')); const ep={lat:e.lat??e.center?.lat??NaN,lon:e.lon??e.center?.lon??NaN}; if(!validPoint(ep)||!t.name||!e.id||!['node','way','relation'].includes(e.type||'')||t.amenity!=='restaurant'||t.disused==='yes'||t.closed==='yes'||t['disused:amenity']||t['abandoned:amenity'])continue; const d=distanceKm(p,ep); if(d>radiusKm+0.2)continue; if(results.some(r=>r.name.toLowerCase()===t.name.toLowerCase()&&distanceKm(r.point,ep)<0.15))continue; results.push({id:`${e.type}/${e.id}`,name:t.name,neighborhood:t['addr:suburb']||t['addr:city']||'',cuisine:(t.cuisine||'').replaceAll(';',', ').replaceAll('_',' '),point:ep,distanceKm:d,website:safeUrl(t.website||t['contact:website']),mapUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,wikipedia:t.wikipedia,wikidata:t.wikidata,fineDining:(t.cuisine||'').split(';').includes('fine_dining')}); }
 return results.sort((a,b)=>(Number(!!storyFor(b))*4+Number(b.fineDining)*2+Number(!!b.wikipedia))-(Number(!!storyFor(a))*4+Number(a.fineDining)*2+Number(!!a.wikipedia))||a.distanceKm-b.distanceKm).slice(0,24)
}
type CommonsImage = { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }
function plainText(value: string): string { return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().slice(0, 300) }
export function commonsPhoto(info: CommonsImage, name: string): RestaurantDetail['photo'] {
 const metadata=info.extmetadata || {}; const license=metadata.LicenseShortName?.value || ''; const licenseUrl=safeUrl(metadata.LicenseUrl?.value); const url=safeUrl(info.thumburl || info.url); const sourceUrl=safeUrl(info.descriptionurl); const credit=plainText(metadata.Artist?.value || '');
 if(!/^(CC BY(?:-SA)? [234]\.0|CC0(?: 1\.0)?|Public domain)$/i.test(license) || !licenseUrl || !url || !sourceUrl || !credit) return;
 if(!['upload.wikimedia.org','thumb.wikimedia.org'].includes(new URL(url).hostname) || new URL(sourceUrl).hostname!=='commons.wikimedia.org' || !['creativecommons.org','commons.wikimedia.org'].includes(new URL(licenseUrl).hostname)) return;
 return {url,alt:`Photograph associated with ${name} on Wikimedia Commons`,credit,license,licenseUrl,sourceUrl}
}
export async function loadRestaurantDetail(restaurant: Restaurant, signal: AbortSignal): Promise<RestaurantDetail> {
 signal.throwIfAborted(); const story=storyFor(restaurant);
 const detail:RestaurantDetail={signatureDish:story?.signatureDish,fact:story ? {text:story.text,sourceLabel:story.name+' official website',sourceUrl:story.url,kind:'editorial'} : {text:restaurant.cuisine ? `OpenStreetMap contributors list ${restaurant.name} as a restaurant serving ${restaurant.cuisine} cuisine.` : `OpenStreetMap contributors list ${restaurant.name} as a restaurant${restaurant.neighborhood ? ` in ${restaurant.neighborhood}` : ''}.`,sourceLabel:'OpenStreetMap contributors',sourceUrl:restaurant.mapUrl,kind:'map'}};
 const knownTitles:Record<string,string>={'Core by Clare Smyth':'Core (restaurant)','The Table':'The Table (restaurant)','Arpège':'Arpège','Le Bernardin':'Le Bernardin','Odette':'Odette (restaurant)'};
 const knownPhotos: Record<string, {file: string; alt: string}> = {
   'Odette': {file: 'Chef Julien Royer Odette.jpg', alt: 'Julien Royer, chef-owner of Odette, photographed in 2018'},
   'Le Bernardin': {file: 'Interior of Le Bernardin.jpg', alt: 'Archival photograph of Le Bernardin’s dining room in 2009'},
 };
 const selectedPhoto = story ? knownPhotos[story.name] : undefined;
 const title=restaurant.wikipedia?.match(/^en:(.+)$/)?.[1] || (story ? knownTitles[story.name] : undefined); if(!title) return detail;
 try {
 const url=`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts%7Cpageimages&piprop=name&exintro=1&explaintext=1&exsentences=3&titles=${encodeURIComponent(title)}`;
 const data: {query?:{pages?:Record<string,{extract?:string;pageimage?:string}>}} = selectedPhoto ? {} : await request(`wiki-media:${title}`,url,signal); const page=Object.values(data.query?.pages||{})[0];
 if(!story && page?.extract) detail.fact={text:page.extract.length > 350 ? page.extract.slice(0,347).replace(/\s+\S*$/, '')+'…' : page.extract,sourceLabel:'Wikipedia',sourceUrl:`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ','_'))}`,kind:'encyclopedia'};
 const imageFile = selectedPhoto?.file || page?.pageimage;
 if(imageFile) {
 const mediaUrl=`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=640&titles=${encodeURIComponent('File:'+imageFile)}`;
 const media=await request<{query?:{pages?:Record<string,{imageinfo?:CommonsImage[]}>}}>(`commons:${imageFile}`,mediaUrl,signal); const info=Object.values(media.query?.pages||{})[0]?.imageinfo?.[0]; if(info) { detail.photo=commonsPhoto(info,restaurant.name); if(detail.photo && selectedPhoto)detail.photo.alt=selectedPhoto.alt; }
 }
 } catch(error) { if(signal.aborted) throw error; /* Editorial and map facts remain available if optional encyclopedia enrichment fails. */ }
 return detail;
}
