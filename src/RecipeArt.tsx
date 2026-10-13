import { useId } from 'react'
import ImageTone from './ImageTone'

export default function RecipeArt() {
  const id = useId().replaceAll(':', '')
  return <div className="food-art">
    <div className="food-art-reveal">
      <svg className="recipe-art" viewBox="80 0 1246 966" preserveAspectRatio="xMidYMin" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Burnt-orange photographic lemons, strawberry, grapes and leaves, in the supplied reference arrangement</title>
        <defs>
          <filter id={`${id}-ink`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            {/* Key the reference's pink paper and red lettering out in the browser.
                The original contours and arrangement are preserved, then rendered in the current three-color duotone palette. */}
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 8 -8 0 -0.7" />
            <ImageTone />
          </filter>
          <clipPath id={`${id}-crop`}><rect width="1326" height="966" /></clipPath>
        </defs>
        <g clipPath={`url(#${id}-crop)`}>
          <image href="/images/fruit-reference.webp" width="1368" height="980" filter={`url(#${id}-ink)`} />
        </g>
      </svg>
    </div>
  </div>
}
