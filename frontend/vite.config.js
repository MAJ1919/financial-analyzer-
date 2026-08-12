import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const REQUIRED = ['VITE_API_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

/**
 * Vite inlines VITE_* vars at BUILD time, so a missing var on the deploy host
 * is not a runtime warning — it is silently baked into the bundle. The specific
 * trap: api.js falls back to 'http://localhost:8000/api', so a production build
 * without VITE_API_URL ships a bundle that asks every visitor's OWN machine for
 * the API. That surfaces as an unexplained "Network Error" in the browser and
 * nothing at all in the build log.
 *
 * So we check at build time. On a deploy host (Vercel/CI) we fail the build —
 * far cheaper than shipping it. Locally we only warn, so `npm run build` still
 * works for smoke-testing a bundle against a localhost backend.
 */
function checkProdEnv(env) {
  const onDeployHost = Boolean(process.env.VERCEL || process.env.CI)
  const problems = []

  for (const key of REQUIRED) {
    if (!env[key]?.trim()) problems.push(`${key} is not set`)
  }
  if (/\/\/(localhost|127\.0\.0\.1)/.test(env.VITE_API_URL ?? '')) {
    problems.push(
      `VITE_API_URL points at localhost ("${env.VITE_API_URL}") — deployed visitors ` +
        `would call their own machine, not your backend`
    )
  }
  if (!problems.length) return

  const detail = problems.map((p) => `  - ${p}`).join('\n')
  if (onDeployHost) {
    throw new Error(
      `\nProduction build blocked — frontend environment is misconfigured:\n${detail}\n\n` +
        `Set these in your Vercel project (Settings > Environment Variables), ` +
        `then redeploy. VITE_API_URL should be your Render backend, ` +
        `e.g. https://financial-analyzer-api.onrender.com/api\n`
    )
  }
  console.warn(
    `\n[vite] Local production build with a non-deployable config:\n${detail}\n` +
      `Fine for testing a bundle locally; this would fail on Vercel.\n`
  )
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix => also surfaces vars injected by the host (Vercel/CI), not just .env files.
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production') checkProdEnv(env)

  return {
    plugins: [react()],
  }
})
