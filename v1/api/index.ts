// Vercel serverless entry point. Same Express app as local dev (server/index.ts) — an Express
// app is directly callable as (req, res), which is exactly what Vercel's Node runtime expects, so
// no adapter is needed. vercel.json rewrites every /api/* request here; Express's own router then
// matches the full original path (e.g. /api/auth/verify) against the routes defined in createApp().
import { createApp } from '../server/index.ts'

export default createApp()
