import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
const shots = '../.impeccable/review'
mkdirSync(shots, { recursive: true })

test('servings, independent timers, recovery and completion remain intact', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'More servings' }).click()
  await expect(page.locator('.servings')).toContainText('3 servings')
  await expect(page.locator('.ingredient-list')).toContainText('225 g')
  await page.getByRole('button', { name: 'Fewer servings' }).click()
  await expect(page.locator('.ingredient-list')).toContainText('150 g')
  await page.getByRole('button', { name: 'Let’s get cooking', exact: true }).click()
  await expect(page.locator('h1')).toBeInViewport()
  await page.getByRole('button', { name: 'Begin cooking' }).click()
  await expect(page.getByRole('heading', { name: 'Get everything ready.' })).toBeVisible()
  for (const name of ['Couscous', 'Chickpeas', 'Almonds']) await page.getByRole('button', { name: `Start ${name}`, exact: true }).click()
  await expect(page.locator('.rail-heading')).toContainText('3 active')
  await page.clock.fastForward(1000)
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cover the couscous.' })).toBeVisible()
  await page.getByRole('button', { name: 'Undo step' }).click()
  await expect(page.getByRole('heading', { name: 'Get everything ready.' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause Couscous', exact: true }).click()
  const paused = await page.getByRole('region', { name: 'Couscous timer' }).locator('.timer-time').textContent()
  await page.clock.fastForward(5000)
  await expect(page.getByRole('region', { name: 'Couscous timer' }).locator('.timer-time')).toHaveText(paused!)
  await page.reload()
  await page.getByRole('button', { name: 'Resume cooking' }).click()
  await page.getByRole('button', { name: 'Resume Couscous', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel Chickpeas', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Pause Chickpeas', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cooking help' }).click()
  await page.getByRole('button', { name: 'Close cooking help' }).press('Enter')
  for (let i = 0; i < 7; i++) {
    await page.clock.fastForward(700)
    await page.getByRole('button', { name: i === 6 ? 'Finish recipe' : 'Next step', exact: true }).click()
  }
  await expect(page.locator('.step-count')).toContainText('Instructions complete')
  await expect(page.locator('.rail-heading')).toContainText('3 active')
  await page.getByRole('button', { name: 'Cook again', exact: true }).click()
  await page.getByRole('button', { name: 'Keep cooking' }).click()
  await expect(page.locator('.step-count')).toContainText('Instructions complete')
  expect(errors).toEqual([])
})

test('timer completion stays individually visible and acknowledgement is independent', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Start cooking', exact: true }).click()
  await page.getByRole('button', { name: 'Begin cooking' }).click()
  await page.getByRole('button', { name: 'Start Almonds', exact: true }).click()
  await page.getByRole('button', { name: 'Start Couscous', exact: true }).click()
  await page.clock.fastForward(301000)
  await expect(page.getByRole('button', { name: 'Silence Almonds' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Silence Couscous' })).toBeVisible()
  await page.getByRole('button', { name: 'Silence Almonds' }).click()
  await expect(page.getByRole('button', { name: 'Silence Couscous' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Almonds timer' })).toContainText('Checked')
})

test('responsive screens, unavailable voice fallback, assets and accessible states', async ({ page }) => {
  test.setTimeout(120000)
  const report: Record<string, unknown> = {}
  const failures: string[] = []
  page.on('pageerror', e => failures.push(e.message))
  page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`) })
  await page.addInitScript(() => { Object.defineProperty(window, 'SpeechRecognition', { value: undefined }); Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined }) })
  const check = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    report[name] = { overflow, violations: a11y.violations.map(v => ({ id:v.id, impact:v.impact, nodes:v.nodes.map(n => ({ target:n.target, summary:n.failureSummary })) })) }
    await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0) })
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true, animations: 'disabled' })
    if(name.startsWith('overview-') || (name.startsWith('cooking-') && !name.includes('help'))) await page.screenshot({path:`${shots}/${name}-viewport.png`,animations:'disabled'})
  }
  for (const [name, width, height] of [['desktop',1440,1000],['landscape',1024,768],['portrait',768,1024],['mobile',390,844]] as const) {
    await page.setViewportSize({width,height})
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await check(`overview-${name}`)
    await page.getByRole('button',{name:'Start cooking',exact:true}).click()
    await check(`setup-${name}`)
    await page.getByRole('button',{name:'Begin cooking'}).click()
    await expect(page.getByRole('button',{name:'Enable voice'})).toBeDisabled()
    for (const name of ['Couscous','Chickpeas','Almonds']) await page.getByRole('button',{name:`Start ${name}`,exact:true}).click()
    await check(`cooking-${name}`)
    if(width >= 768) {
      const dock = await page.locator('.cooking-dock').boundingBox()
      for(const control of await page.locator('.timer-actions button').all()) {
        const target = await control.boundingBox()
        expect(target!.y + target!.height).toBeLessThanOrEqual(dock!.y + 1)
      }
    }
    await page.reload()
    await check(`resume-${name}`)
  }
  await page.setViewportSize({width:1024,height:768})
  await page.getByRole('button',{name:'Resume cooking'}).click()
  await page.getByRole('button',{name:'Cooking help'}).click()
  await check('cooking-help')
  await page.getByRole('button',{name:'Close cooking help'}).click()
  await page.getByRole('button',{name:'Cancel Couscous',exact:true}).click()
  await check('timer-confirmation')
  await page.keyboard.press('Escape')
  await page.clock.install()
  await page.clock.fastForward(361000)
  await check('timer-attention')
  for(let i=0;i<7;i++) {await page.clock.fastForward(700);await page.getByRole('button',{name:i===6?'Finish recipe':'Next step',exact:true}).click()}
  await check('completion')
  for(const [source,target] of [['overview-desktop','overview'],['cooking-landscape-viewport','cooking-landscape'],['cooking-portrait-viewport','cooking-portrait'],['timer-attention','timer-attention']]) copyFileSync(`${shots}/${source}.png`,`public/screenshots/${target}.png`)
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const) {
    await page.setViewportSize({width,height}); await page.goto('/case-study');
    await page.locator('img').evaluateAll(imgs => imgs.forEach(img => img.loading = 'eager'))
    await page.waitForFunction(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0))
    await check(`case-study-${name}`)
  }
  writeFileSync(`${shots}/inspection.json`,JSON.stringify({screens:report,failures},null,2))
  expect(failures).toEqual([])
  for(const result of Object.values(report) as {overflow:boolean;violations:unknown[]}[]) {expect(result.overflow).toBe(false);expect(result.violations).toEqual([])}
})

test('keyboard navigation and simulated voice states keep a usable touch fallback', async ({ page }) => {
  await page.addInitScript(() => {
    class RecognitionMock {
      onstart?: () => void
      onspeechend?: () => void
      onerror?: (e: {error:string}) => void
      onend?: () => void
      onresult?: (e: unknown) => void
      constructor() { (window as unknown as { testRecognition: RecognitionMock }).testRecognition = this }
      start() { this.onstart?.() }
      abort() { this.onend?.() }
    }
    Object.defineProperty(window, 'SpeechRecognition', {value:RecognitionMock})
  })
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button',{name:'Start cooking',exact:true}).click()
  await page.getByRole('button',{name:'Enable voice',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('may send it to an online recognition service')
  await page.getByRole('button',{name:'Use buttons'}).press('Enter')
  await page.getByRole('button',{name:'Begin cooking'}).press('Enter')
  await page.locator('h1').click()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('h1')).toContainText('Cover the couscous')
  await page.clock.fastForward(700)
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('h1')).toContainText('Get everything ready')
  await page.getByRole('button',{name:'Enable voice',exact:true}).click()
  await page.getByRole('button',{name:'Allow voice and continue'}).click()
  await expect(page.locator('.voice-bar')).toHaveClass(/voice-listening/)
  await page.evaluate(() => (window as unknown as {testRecognition:{onspeechend:()=>void}}).testRecognition.onspeechend())
  await expect(page.locator('.voice-bar')).toHaveClass(/voice-processing/)
  await page.evaluate(() => (window as unknown as {testRecognition:{onerror:(e:{error:string})=>void}}).testRecognition.onerror({error:'not-allowed'}))
  await expect(page.locator('.voice-bar')).toContainText('Microphone permission denied')
  await expect(page.locator('.voice-bar')).toHaveClass(/voice-error/)
  await page.clock.fastForward(700)
  await page.getByRole('button',{name:'Next step',exact:true}).click()
  await expect(page.locator('h1')).toContainText('Cover the couscous')
})

test('hero stays flat and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto('/')
  const art = page.locator('.recipe-intro .food-art')
  const box = await art.boundingBox()
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.6)
  await expect(art).toHaveCSS('transform','none')
  await expect(art).toHaveCSS('perspective','none')
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(page.locator('.recipe-intro .food-art-reveal')).toHaveCSS('animation-name','none')
})
