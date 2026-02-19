# Lifti

Lifti is a Vite + React single-page app configured for deployment to GitHub Pages.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The app is configured with a Vite base path of `/lifti/` and uses hash-based routing for GitHub Pages compatibility.

## GitHub Pages deployment settings

After committing the workflow, verify these repository settings:

1. **Settings → Pages → Build and deployment → Source** must be set to **GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions** must be set to **Read and write permissions**.

## Google OAuth + Drive appDataFolder setup

Lifti uses Google Sign-In from the browser and stores JSON data in the hidden Drive `appDataFolder` using this scope:

- `https://www.googleapis.com/auth/drive.appdata`

### 1) Configure Google OAuth client

Create an OAuth 2.0 Web application in Google Cloud and copy the **Client ID**.

Set authorized JavaScript origins for local and production:

- `http://localhost:5173`
- `https://<your-github-username>.github.io`

Set authorized redirect URIs (for GitHub Pages callback support):

- `https://<your-github-username>.github.io/lifti`
- `http://localhost:5173`

### 2) Add GitHub secret

In your GitHub repository:

1. Go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Name it `VITE_GOOGLE_CLIENT_ID`.
4. Paste your Google OAuth Client ID value.

### 3) Inject secret in GitHub Actions build

The Pages workflow passes the secret into Vite at build time:

```yml
- name: Build
  env:
    VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
  run: npm run build
```

### Notes

- Data is written to Google Drive `appDataFolder` and is **not visible in My Drive**.
- The access token is stored in `sessionStorage` only (not `localStorage`).


## PWA install verification

1. Open Chrome DevTools → **Application** and click **Clear storage** for the site.
2. Reload the app and confirm the **Manifest** is detected from `/lifti/manifest.webmanifest`.
3. Confirm the **Service Workers** panel shows `sw.js` as active and running.
4. Visit the app twice (or use the browser menu) and check **Install app** appears.
