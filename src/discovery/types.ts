export interface Point { lat: number; lon: number }
export interface City { id: string; name: string; label: string; point: Point }
export interface Restaurant { id: string; name: string; neighborhood: string; cuisine: string; point: Point; distanceKm: number; website?: string; mapUrl: string; wikipedia?: string; wikidata?: string; fineDining: boolean }
export interface RestaurantDetail { fact: { text: string; sourceLabel: string; sourceUrl: string; kind: 'editorial' | 'encyclopedia' | 'map' }; photo?: { url: string; alt: string; credit: string; license: string; licenseUrl: string; sourceUrl: string }; signatureDish?: string }
