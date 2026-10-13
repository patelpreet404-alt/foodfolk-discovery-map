export type Privacy = 'public' | 'friends' | 'private'

export type User = {
  id: string
  name: string
  username: string
  avatar: string | null
  discoverable: boolean
  defaultVisibility: Privacy
  reviewCount: number
  savedCount: number
}

export type Review = {
  id: string
  user: Pick<User, 'id' | 'name' | 'username'>
  rating: number
  body: string
  dishes: string[]
  price: string | null
  visibility: Privacy
  photos: string[]
  createdAt: string
}

export type Restaurant = {
  id: string
  name: string
  cuisine: string
  address: string
  lat: number
  lng: number
  source: 'OpenStreetMap'
  sourceUrl: string
  reviews: Review[]
  rating: number | null
  friendCount: number
  saved: boolean
  reviewCount: number
}

export type FriendsResponse = {
  friends: User[]
  incoming: { id: string; user: User }[]
  outgoing: { id: string; user: User }[]
}
