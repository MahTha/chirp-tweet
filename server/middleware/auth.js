import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'chirp_session'
const DEV_FALLBACK_SECRET = 'chirp-dev-secret'

let warnedMissingSecret = false

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET

  if (!warnedMissingSecret) {
    console.warn(
      'JWT_SECRET is not set — falling back to an insecure development secret. Set JWT_SECRET in .env (see .env.example).'
    )
    warnedMissingSecret = true
  }
  return DEV_FALLBACK_SECRET
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, getJwtSecret(), { expiresIn: '7d' })
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' })
  }

  try {
    const payload = jwt.verify(token, getJwtSecret())
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Not authenticated.' })
  }
}

export const SESSION_COOKIE = COOKIE_NAME
