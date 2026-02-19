let gisLoadingPromise

const GIS_SCRIPT_SELECTOR = 'script[data-gis="true"]'

export async function loadGis() {
  if (window.google?.accounts?.oauth2) {
    return
  }

  if (!gisLoadingPromise) {
    gisLoadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(GIS_SCRIPT_SELECTOR)
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('GIS script failed to load')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.gis = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('GIS script failed to load'))
      document.head.appendChild(script)
    })
  }

  await gisLoadingPromise

  if (!window.google?.accounts?.oauth2) {
    throw new Error('GIS loaded but google.accounts.oauth2 missing')
  }
}
