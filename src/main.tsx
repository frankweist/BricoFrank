import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// Si tu App es export default:
const App = lazy(() => import('./App'))

// Si tu App es export nombrado: export const App = ...
// usa esta lÃƒÂ­nea en su lugar y elimina la anterior:
// const App = lazy(() => import('./App').then(m => ({ default: m.App })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div>CargandoÃ¢\u20ACÂ¦</div>}>
      <App />
    </Suspense>
  </StrictMode>
)


