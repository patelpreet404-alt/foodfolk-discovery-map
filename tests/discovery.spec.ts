import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'

const shots = '../.impeccable/review/discovery'
mkdirSync(shots, { recursive: true })
const city = { type: 'Feature', properties: { name: 'London', state: 'England', country: 'United Kingdom', osm_value: 'city', osm_type: 'R', osm_id: 1 }, geometry: { type: 'Point', coordinates: [-0.1276, 51.5072] } }
const places = [
  { type: 'node', id: 100, lat: 51.508, lon: -0.128, tags: { amenity: 'restaurant', name: 'Fixture Kitchen', cuisine: 'fine_dining', 'addr:suburb': 'Fixture district', wikipedia: 'en:Fixture Kitchen', website: 'https://example.org/restaurant' } },
  { type: 'node', id: 101, lat: 51.509, lon: -0.129, tags: { amenity: 'restaurant', name: 'Second Fixture Kitchen', cuisine: 'french', wikipedia: 'en:Second Fixture Kitchen' } },
]
async function providers(page: Page, mode: 'success' | 'empty' | 'error' = 'success') {
  const requests: string[] = []
  await page.route('https://**/*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/api/interpreter')) {
      requests.push(route.request().postData() || url.search)
      return route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ elements: mode === 'empty' ? [] : places }) })
    }
    if (url.hostname.includes('photon') || url.pathname === '/reverse') return route.fulfill({ json: { features: [city] } })
    if (url.hostname === 'en.wikipedia.org') return route.fulfill({ json: { query: { pages: { 1: { extract: 'This is an explicitly simulated culinary story used only for browser verification.' } } } } })
    return route.continue()
  })
  return requests
}
async function chooseCity(page: Page) {
  await page.getByLabel('Choose a city', { exact: true }).fill('London')
  await page.getByRole('button', { name: 'Search cities', exact: true }).click()
  await page.getByRole('button', { name: 'London, England, United Kingdom' }).click()
}

test('explicit permission, manual city selection, carousel, radius and clearing', async ({ page }) => {
  let calls = 0
  const requests = await providers(page)
  await page.exposeFunction('recordGeo', () => { calls++ })
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: () => { void (window as unknown as { recordGeo: () => Promise<void> }).recordGeo() } } }))
  await page.goto('/')
  await expect(page.locator('.discovery-invitation')).toBeVisible()
  expect(calls).toBe(0)
  expect(requests).toHaveLength(0)
  await chooseCity(page)
  await expect(page.locator('.restaurant-story h3')).toHaveText('Fixture Kitchen')
  await expect(page.locator('.culinary-fact-text')).toContainText('explicitly simulated')
  await expect(page.getByRole('link', { name: /Explore restaurant/ })).toHaveAttribute('href', 'https://example.org/restaurant')
  await page.getByRole('button', { name: 'Next restaurant' }).press('Enter')
  await expect(page.locator('.restaurant-story h3')).toHaveText('Second Fixture Kitchen')
  await page.getByRole('button', { name: 'Previous restaurant' }).click()
  await page.getByLabel('Look within').selectOption('15')
  await expect(page.locator('.discovery-results-context')).toContainText('15 km')
  expect(requests).toHaveLength(2)
  expect(requests[1]).not.toBe(requests[0])
  const bounds = new URLSearchParams(requests[1]).get('data')!.match(/nwr\(([^)]+)\)/)![1].split(',').map(Number)
  expect(bounds[2] - bounds[0]).toBeCloseTo(30 / 110.574, 4)
  await page.getByRole('button', { name: 'Clear restaurant location' }).click()
  await expect(page.locator('.discovery-invitation')).toBeVisible()
  await expect(page.locator('.restaurant-carousel')).toHaveCount(0)
  await page.getByRole('button', { name: 'Discover near me' }).click()
  await expect.poll(() => calls).toBe(1)
})

for (const [name, code, message] of [['denied', 1, 'Location permission is off'], ['unavailable', 2, 'Your location is unavailable'], ['timeout', 3, 'Finding your location took too long']] as const) {
  test(`${name} device location leaves manual city search usable`, async ({ page }) => {
    await providers(page)
    await page.addInitScript(code => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_success: unknown, error: (value: {code:number}) => void) => error({ code }) } }), code)
    await page.goto('/')
    await page.getByRole('button', { name: 'Discover near me' }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await chooseCity(page)
    await expect(page.locator('.restaurant-story h3')).toHaveText('Fixture Kitchen')
  })
}

test('missing geolocation, empty results and provider failures are recoverable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: undefined }))
  await providers(page, 'empty')
  await page.goto('/')
  await page.getByRole('button', { name: 'Discover near me' }).click()
  await expect(page.getByRole('alert')).toContainText('This browser cannot provide a location')
  await chooseCity(page)
  await expect(page.locator('.discovery-status-empty')).toContainText('No documented kitchens')
  await page.getByRole('button', { name: 'Expand to 25 km' }).click()
  await expect(page.locator('.discovery-status-empty')).toContainText('within 25 km')
  await page.unroute('https://**/*')
  await providers(page, 'error')
  await page.getByRole('button', { name: 'Clear restaurant location' }).click()
  await page.getByLabel('Look within').selectOption('5')
  await chooseCity(page)
  await expect(page.getByRole('alert')).toContainText('503')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('editorial discovery remains accessible and fits phone, tablet and desktop', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await providers(page)
  for (const [name, width, height] of [['phone', 390, 844], ['portrait', 768, 1024], ['landscape', 1024, 768], ['desktop', 1440, 1000]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('#around-your-table').scrollIntoViewIfNeeded()
    await page.locator('#around-your-table').screenshot({ path: `${shots}/idle-${name}.png`, animations: 'disabled' })
    await chooseCity(page)
    await expect(page.locator('.culinary-fact-text')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    expect.soft(overflow.scroll).toBeLessThanOrEqual(overflow.width)
    const result = await new AxeBuilder({ page }).include('#around-your-table').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect.soft(result.violations).toEqual([])
    await page.locator('#around-your-table').screenshot({ path: `${shots}/ready-${name}.png`, animations: 'disabled' })
  }
  expect(errors).toEqual([])
  await page.getByRole('button', { name: 'Clear restaurant location' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.discovery-stamp')).toHaveCSS('animation-name', 'none')
})
