import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ChirpLogo from '../components/ChirpLogo'
import { fetchTweets, fetchDashboardSummary, formatRelativeTime, postTweet } from '../lib/dashboard'
import './Home.css'

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠', active: true },
  { label: 'Explore', icon: '🔍' },
  { label: 'Notifications', icon: '🔔' },
  { label: 'Messages', icon: '✉️' },
  { label: 'Profile', icon: '👤', to: '/profile' },
]

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name }) {
  return <div className="avatar">{initials(name)}</div>
}

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tweets, setTweets] = useState([])
  const [stats, setStats] = useState({ totalTweets: 0, totalAuthors: 0 })
  const [breakdown, setBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [scope, setScope] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const isFirstRun = useRef(true)

  const [composerText, setComposerText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const composerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchTweets({ scope: 'all', search: '' }), fetchDashboardSummary()])
      .then(([tweetsResult, summaryResult]) => {
        if (cancelled) return

        if (!tweetsResult.ok) {
          setError(tweetsResult.error)
          return
        }
        if (!summaryResult.ok) {
          setError(summaryResult.error)
          return
        }

        setTweets(tweetsResult.tweets)
        setStats(summaryResult.stats)
        setBreakdown(summaryResult.breakdown)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    let cancelled = false
    setFeedLoading(true)
    setFeedError('')

    fetchTweets({ scope, search: debouncedSearch }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setFeedError(result.error)
      } else {
        setTweets(result.tweets)
      }
      setFeedLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [scope, debouncedSearch])

  async function handleSubmitTweet(e) {
    e.preventDefault()
    const trimmed = composerText.trim()
    if (!trimmed || trimmed.length > 280 || posting) return

    setPosting(true)
    setPostError('')

    const result = await postTweet(trimmed)

    if (!result.ok) {
      setPostError(result.error)
      setPosting(false)
      return
    }

    setComposerText('')
    setPosting(false)

    const [tweetsResult, summaryResult] = await Promise.all([
      fetchTweets({ scope, search: debouncedSearch }),
      fetchDashboardSummary(),
    ])
    if (tweetsResult.ok) setTweets(tweetsResult.tweets)
    if (summaryResult.ok) {
      setStats(summaryResult.stats)
      setBreakdown(summaryResult.breakdown)
    }
  }

  function handleResetFilters() {
    setSearchInput('')
    setDebouncedSearch('')
    setScope('all')
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="home-layout">
      <aside className="home-sidebar">
        <div className="home-logo">
          <ChirpLogo size={38} />
          <span>Chirp</span>
        </div>

        <nav className="home-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`home-nav-item${item.active ? ' home-nav-item-active' : ''}`}
              onClick={item.to ? () => navigate(item.to) : undefined}
            >
              <span className="home-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="btn btn-primary btn-wide home-tweet-btn"
          onClick={() => {
            composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            composerRef.current?.focus()
          }}
        >
          <span>Tweet</span>
        </button>

        <div className="home-user">
          <div className="home-user-row">
            <Avatar name={user?.username ?? 'You'} />
            <div className="home-user-info">
              <strong>{user?.username}</strong>
              <span>@{user?.username}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-wide home-logout"
            onClick={handleLogout}
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="home-feed">
        <header className="home-feed-header">
          <nav className="home-tabs">
            <button type="button" className="home-tab home-tab-active">
              For you
            </button>
            <button type="button" className="home-tab">
              Following
            </button>
          </nav>

          <div className="home-filter-bar">
            <input
              type="search"
              className="home-search-input"
              placeholder="Search tweets"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="home-scope-toggle">
              <button
                type="button"
                className={`home-scope-btn${scope === 'all' ? ' home-scope-btn-active' : ''}`}
                onClick={() => setScope('all')}
              >
                All Tweets
              </button>
              <button
                type="button"
                className={`home-scope-btn${scope === 'mine' ? ' home-scope-btn-active' : ''}`}
                onClick={() => setScope('mine')}
              >
                My Tweets Only
              </button>
            </div>
            {(searchInput || scope === 'mine') && (
              <button type="button" className="home-filter-reset" onClick={handleResetFilters}>
                Reset
              </button>
            )}
          </div>
        </header>

        <form className="composer" onSubmit={handleSubmitTweet}>
          <Avatar name={user?.username ?? 'You'} />
          <div className="composer-body">
            <textarea
              ref={composerRef}
              className="composer-input"
              placeholder="What's happening?"
              value={composerText}
              maxLength={280}
              onChange={(e) => setComposerText(e.target.value)}
            />
            {postError && <p className="composer-error">{postError}</p>}
            <div className="composer-footer">
              <span className="composer-count">{280 - composerText.length}</span>
              <button
                type="submit"
                className="btn btn-primary composer-submit"
                disabled={!composerText.trim() || composerText.length > 280 || posting}
              >
                {posting ? 'Posting…' : 'Tweet'}
              </button>
            </div>
          </div>
        </form>

        {loading && <p className="home-feed-status">Loading tweets…</p>}

        {!loading && (error || feedError) && (
          <p className="home-feed-status home-feed-error">{error || feedError}</p>
        )}

        {!loading && !error && !feedError && feedLoading && (
          <p className="home-feed-status">Loading tweets…</p>
        )}

        {!loading && !error && !feedError && !feedLoading && tweets.length === 0 && (
          <div className="home-card home-feed-empty">
            <p>
              {scope === 'mine' || debouncedSearch
                ? 'No tweets match your search guidelines.'
                : 'No tweets yet'}
            </p>
          </div>
        )}

        {!loading && !error && !feedError && !feedLoading && tweets.length > 0 && (
          <ul className="tweet-list">
            {tweets.map((tweet) => (
              <li key={tweet.id} className="tweet">
                <Avatar name={tweet.username} />
                <div className="tweet-body">
                  <div className="tweet-meta">
                    <strong>{tweet.username}</strong>
                    <span className="tweet-handle">@{tweet.username}</span>
                    <span className="tweet-dot">&middot;</span>
                    <span className="tweet-time">{formatRelativeTime(tweet.created_at)}</span>
                  </div>
                  <p className="tweet-content">{tweet.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <aside className="home-right">
        <div className="home-card home-stats-card">
          <h2>Summary stats</h2>
          <div className="home-stat-row">
            <span>Total tweets</span>
            <strong>{loading ? '—' : stats.totalTweets}</strong>
          </div>
          <div className="home-stat-row">
            <span>Total authors</span>
            <strong>{loading ? '—' : stats.totalAuthors}</strong>
          </div>
        </div>

        <div className="home-card home-breakdown-card">
          <h2>Author breakdown</h2>
          {loading && <p className="home-card-status">Loading…</p>}
          {!loading && breakdown.length === 0 && (
            <p className="home-card-status">No authors yet</p>
          )}
          {!loading && breakdown.length > 0 && (
            <ul className="home-breakdown-list">
              {breakdown.map((author) => (
                <li key={author.username} className="home-breakdown-row">
                  <span>{author.username}</span>
                  <strong>{author.tweet_count}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="home-card">
          <h2>What's happening</h2>
          <div className="trend">
            <span className="trend-tag">Trending</span>
            <strong>#FrontendOnly</strong>
            <span className="trend-count">1,204 Tweets</span>
          </div>
          <div className="trend">
            <span className="trend-tag">Technology &middot; Trending</span>
            <strong>#ReactRouter</strong>
            <span className="trend-count">856 Tweets</span>
          </div>
          <div className="trend">
            <span className="trend-tag">Trending in Tech</span>
            <strong>#ChirpApp</strong>
            <span className="trend-count">312 Tweets</span>
          </div>
        </div>
      </aside>
    </div>
  )
}
