import { ArrowDown, ArrowRight, Clock3, Leaf, Mic, Minus, Plus, Timer } from 'lucide-react'
import { quantity, recipe } from './domain'
import type { Action, Session } from './domain'
import RecipeArt from './RecipeArt'
import RestaurantDiscovery from './discovery/RestaurantDiscovery'

type Props = { session: Session; act: (action: Action) => void }

export default function RecipeOverview({ session, act }: Props) {
  return <main id="main" className="overview">
    <section className="recipe-intro" aria-labelledby="hero-title">
      <div className="intro-copy">
        <p className="editorial-label"><span className="label-dot" aria-hidden="true" />GOOD FOOD. A LITTLE LESS FUSS.</p>
        <h1 id="hero-title">Hands messy.<br />Cooking <span>easy.</span></h1>
      </div>
      <div className="art-wrap">
        <RecipeArt />
      </div>
      <div className="intro-support">
        <p className="intro-description">Get stuck into the good part.<br />We’ll take it one step at a time.</p>
        <p className="hero-menu">Today’s cook: Lemon chickpea couscous · 20 min</p>
        <div className="hero-actions">
          <button className="primary start-button" onClick={() => act({ type: 'phase', phase: 'setup' })}>Start cooking <ArrowRight size={24} /></button>
          <a className="explore-link" href="#recipe">Explore the recipe <ArrowDown size={19} /></a>
        </div>
      </div>
    </section>
    <div className="kitchen-strip" aria-label="Cooking mode features"><span><Mic size={20} /> Your voice. Your pace.</span><span><Timer size={20} /> Every timer, in sight.</span><span><ArrowRight size={20} /> One clear step at a time.</span></div>
    <section className="recipe-feature" id="recipe" aria-labelledby="recipe-title">
      <div className="recipe-feature-heading"><div><p className="editorial-label">A GOOD PLACE TO BEGIN</p><h2 id="recipe-title">Small effort.<br />Big lemon energy.</h2></div><div className="recipe-feature-copy"><h3>{recipe.title}</h3><p>Fluffy couscous, warm chickpeas, toasted almonds. A bright lemon dressing to bring it all together.</p><div className="recipe-meta"><span><Clock3 size={18} /> About 20 min</span><span>7 steps</span><span><Leaf size={18} /> Vegetarian</span></div></div></div>
      <div className="recipe-prep">
        <section className="ingredient-overview" aria-labelledby="ingredient-heading">
          <div className="section-heading"><h3 id="ingredient-heading">On your counter</h3><div className="servings" aria-label="Choose servings"><button aria-label="Fewer servings" disabled={session.servings === 1} onClick={() => act({ type: 'setServings', servings: session.servings - 1 })}><Minus size={20} /></button><span aria-live="polite">{session.servings} servings</span><button aria-label="More servings" disabled={session.servings === 8} onClick={() => act({ type: 'setServings', servings: session.servings + 1 })}><Plus size={20} /></button></div></div>
          <ul className="ingredient-list">{recipe.ingredients.map(i => <li key={i.id}><span>{i.name}</span><strong>{quantity(i.amount, i.unit, session.servings)}</strong></li>)}</ul>
          <p className="fine">Quantities scale for 1–8 servings. Cooking times do not. Use suitably sized pans. Contains wheat and almonds.</p>
        </section>
        <section className="recipe-map" aria-labelledby="plan-heading"><h3 id="plan-heading">The plan, before the pans.</h3><ol>{recipe.steps.map((s, i) => <li key={s.id}><span>{String(i + 1).padStart(2, '0')}</span>{s.title}</li>)}</ol><p className="fine">You’ll need a heatproof bowl with a cover, two pans, a fork and a small bowl. Authored demonstration recipe; not kitchen-tested.</p></section>
      </div>
      <div className="recipe-ready"><p>Counter ready?<br /><strong>Let’s make something good.</strong></p><button className="primary" onClick={() => act({ type: 'phase', phase: 'setup' })}>Let’s get cooking <ArrowRight /></button></div>
    </section>
    <RestaurantDiscovery />
  </main>
}
