import { afterEach, describe, expect, it, vi } from 'vitest'
import { coarsePoint, commonsPhoto, discoverRestaurants, distanceKm, safeUrl, searchCities } from './data'
afterEach(()=>vi.unstubAllGlobals())
describe('discovery data',()=>{
 it('computes approximate geographic distances and rounds location before sharing',()=>{expect(distanceKm({lat:0,lon:0},{lat:0,lon:1})).toBeCloseTo(111.195,2); expect(coarsePoint({lat:19.123456,lon:72.987654})).toEqual({lat:19.123,lon:72.988}); expect(()=>coarsePoint({lat:NaN,lon:0})).toThrow()})
 it('rejects executable and credential-bearing outbound URLs',()=>{expect(safeUrl('javascript:alert(1)')).toBeUndefined(); expect(safeUrl('https://user:pass@example.com')).toBeUndefined(); expect(safeUrl('http://example.com')).toBe('https://example.com/')})
 it('rejects an invalid radius before requesting data',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(discoverRestaurants({lat:0,lon:0},100,new AbortController().signal)).rejects.toThrow('radius');expect(fetch).not.toHaveBeenCalled()})
 it('does not request data with an already aborted signal',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const c=new AbortController();c.abort();await expect(searchCities('Aborted town',c.signal)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled()})
 it('filters nonplaces and malformed coordinates and caches successful searches',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({features:[{properties:{name:'Testville',osm_value:'city',osm_id:1,osm_type:'N',country:'Testland'},geometry:{coordinates:[4,5]}},{properties:{name:'Street',osm_value:'street'},geometry:{coordinates:[4,5]}},{properties:{name:'Broken',osm_value:'city'},geometry:{coordinates:[300,5]}}]})});vi.stubGlobal('fetch',fetch);const signal=new AbortController().signal;const cities=await searchCities('Unique testville',signal);expect(cities).toHaveLength(1);expect(cities[0].name).toBe('Testville');await searchCities('Unique testville',signal);expect(fetch).toHaveBeenCalledTimes(1)})
 it('reports malformed provider responses',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({error:'broken'})}));await expect(searchCities('Malformed city',new AbortController().signal)).rejects.toThrow('unreadable')})
 it('filters closed and invalid restaurants and deduplicates mapped buildings',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[{type:'node',id:1,lat:1,lon:1,tags:{name:'Live',amenity:'restaurant',cuisine:'fine_dining'}},{type:'way',id:2,center:{lat:1,lon:1},tags:{name:'Live',amenity:'restaurant'}},{type:'node',id:3,lat:1,lon:1,tags:{name:'Closed',amenity:'restaurant',closed:'yes'}},{type:'node',id:4,lat:NaN,lon:1,tags:{name:'Broken',amenity:'restaurant'}}]})}));const result=await discoverRestaurants({lat:1,lon:1},5,new AbortController().signal);expect(result).toHaveLength(1);expect(result[0].fineDining).toBe(true)})
})


describe('source integrity', () => {
 it('does not cache incomplete map responses, allowing a real retry', async () => {
   const fetch = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({elements:[],remark:'Query timed out'})}).mockResolvedValueOnce({ok:true,json:async()=>({elements:[]})})
   vi.stubGlobal('fetch',fetch)
   const signal = new AbortController().signal
   await expect(discoverRestaurants({lat:2,lon:2},5,signal)).rejects.toThrow('could not finish')
   await expect(discoverRestaurants({lat:2,lon:2},5,signal)).resolves.toEqual([])
   expect(fetch).toHaveBeenCalledTimes(2)
 })
 it('requires verifiable photo credit, source and an approved license', () => {
   const info = {thumburl:'https://upload.wikimedia.org/example.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Example.jpg',extmetadata:{Artist:{value:'<a>Named photographer</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}
   expect(commonsPhoto(info,'Example')?.credit).toBe('Named photographer')
   expect(commonsPhoto({...info,thumburl:'https://thumb.wikimedia.org/example.jpg'},'Example')?.url).toBe('https://thumb.wikimedia.org/example.jpg')
   expect(commonsPhoto({...info,extmetadata:{...info.extmetadata,LicenseShortName:{value:'All rights reserved'}}},'Example')).toBeUndefined()
   expect(commonsPhoto({...info,thumburl:'https://unknown.example/photo.jpg'},'Example')).toBeUndefined()
   expect(commonsPhoto({...info,extmetadata:{...info.extmetadata,Artist:{value:''}}},'Example')).toBeUndefined()
 })
})
