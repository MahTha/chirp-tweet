import { createApp } from "../server/app.js";
import { initDb } from "../server/db.js";

const app = createApp()
// Runs once per cold start; every migration inside uses IF NOT EXISTS so
// it's safe and cheap to await again on warm invocations too.
const ready = initDb().catch((err) => {
  console.error('Fatal: failed to initialize database.', err)
})

export default async function handler(req, res) {
  await ready
  return app(req, res)
}