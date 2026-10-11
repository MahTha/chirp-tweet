import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ChirpLogo from '../components/ChirpLogo'
import TweetVisibilityToggle from '../components/TweetVisibilityToggle'
import TweetComments from '../components/TweetComments'
import { fetchTweets, formatRelativeTime, postTweet } from '../lib/dashboard'

import './Home.css'

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠', active: true },
  { label: 'Notifications', icon: '🔔' },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tweets, setTweets] = useState([])


  const [scope, setScope] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState('')

  const [composerText, setComposerText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const composerRef = useRef(null)

  

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
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

    const tweetsResult = await fetchTweets({ scope, search: debouncedSearch })
    if (tweetsResult.ok) setTweets(tweetsResult.tweets)

  }

  function handleResetFilters() {
    setSearchInput('')
    setDebouncedSearch('')
    setScope('all')
  }

  function handleTweetToggled(tweetId, isVisible) {
    setTweets((prev) =>
      prev.map((tweet) => (tweet.id === tweetId ? { ...tweet, is_visible: isVisible } : tweet))
    )
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`home-layout${sidebarCollapsed ? ' home-layout-collapsed' : ''}`}>
      <aside className="home-sidebar">
        <button type='button' className="home-logo" onClick={() => setSidebarCollapsed((prev) => !prev)}>
          <ChirpLogo size={38} />
          <span>Chirp</span>
        </button>

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
            <Avatar name={user?.displayName || user?.username || 'You'} />
            <div className="home-user-info">
              <strong>{user?.displayName || user?.username}</strong>
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
          <Avatar name={user?.displayName || user?.username || 'You'} />
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

        {feedLoading && <p className="home-feed-status">Loading tweets…</p>}

        {!feedLoading && feedError && (
          <p className="home-feed-status home-feed-error">{feedError}</p>
        )}

        {!feedLoading && !feedError && tweets.length === 0 && (
          <div className="home-card home-feed-empty">
            <p>
              {scope === 'mine' || debouncedSearch
                ? 'No tweets match your search guidelines.'
                : 'No tweets yet'}
            </p>
          </div>
        )}

        {!feedLoading && !feedError && tweets.length > 0 && (
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
                  {tweet.user_id === user?.id && (
                    <TweetVisibilityToggle tweet={tweet} onToggled={handleTweetToggled} />
                  )}
                  <TweetComments tweet={tweet} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>


    </div>
  )
}
