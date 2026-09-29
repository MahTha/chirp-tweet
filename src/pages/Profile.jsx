import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchProfile,
  updateProfile,
  changePassword,
  updateTweetsVisibility,
  updateDisplayName,
} from '../lib/auth'
import './Auth.css'
import './Profile.css'

function formatJoinDate(createdAt) {
  const date = new Date(createdAt.replace(' ', 'T') + 'Z')
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

export default function Profile() {
  const { updateUsername } = useAuth()

  const [loading, setLoading] = useState(true)
  const [joinedAt, setJoinedAt] = useState(null)

  const [displayName, setDisplayName] = useState('')
  const [displayNameError, setDisplayNameError] = useState('')
  const [displayNameSuccess, setDisplayNameSuccess] = useState('')
  const [savingDisplayName, setSavingDisplayName] = useState(false)

  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [tweetsVisible, setTweetsVisible] = useState(true)
  const [visibilityError, setVisibilityError] = useState('')
  const [savingVisibility, setSavingVisibility] = useState(false)

  useEffect(() => {
    fetchProfile().then((result) => {
      if (result.ok) {
        setDisplayName(result.profile.display_name ?? '')
        setUsername(result.profile.username)
        setJoinedAt(result.profile.created_at)
        setTweetsVisible(result.profile.tweets_visible)
      }
      setLoading(false)
    })
  }, [])

  async function handleDisplayNameSubmit(e) {
    e.preventDefault()
    setDisplayNameError('')
    setDisplayNameSuccess('')
    setSavingDisplayName(true)

    const result = await updateDisplayName({ displayName })
    setSavingDisplayName(false)

    if (result.ok) {
      setDisplayName(result.displayName)
      setDisplayNameSuccess('Name updated.')
    } else {
      setDisplayNameError(result.error)
    }
  }

  async function handleUsernameSubmit(e) {
    e.preventDefault()
    setUsernameError('')
    setUsernameSuccess('')
    setSavingUsername(true)

    const result = await updateProfile({ username })
    setSavingUsername(false)

    if (result.ok) {
      setUsername(result.profile.username)
      updateUsername(result.profile.username)
      setUsernameSuccess('Username updated.')
    } else {
      setUsernameError(result.error)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setSavingPassword(true)
    const result = await changePassword({ currentPassword, newPassword })
    setSavingPassword(false)

    if (result.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password updated.')
    } else {
      setPasswordError(result.error)
    }
  }

  async function handleToggleVisibility() {
    setVisibilityError('')
    setSavingVisibility(true)

    const nextVisible = !tweetsVisible
    const result = await updateTweetsVisibility({ visible: nextVisible })
    setSavingVisibility(false)

    if (result.ok) {
      setTweetsVisible(result.tweetsVisible)
    } else {
      setVisibilityError(result.error)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-content">
        <Link to="/home" className="profile-back">
          &larr; Back to home
        </Link>

        <div className="profile-card">
          <h2>Profile</h2>
          {loading ? (
            <p className="profile-loading">Loading...</p>
          ) : (
            <>
              {joinedAt && <p className="profile-joined">Joined {formatJoinDate(joinedAt)}</p>}
              <form onSubmit={handleDisplayNameSubmit} className="auth-form">
                <label className="field">
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </label>

                {displayNameError && <p className="auth-error">{displayNameError}</p>}
                {displayNameSuccess && <p className="auth-success">{displayNameSuccess}</p>}

                <button type="submit" className="btn btn-primary btn-wide" disabled={savingDisplayName}>
                  Save name
                </button>
              </form>

              <form onSubmit={handleUsernameSubmit} className="auth-form">
                <label className="field">
                  <span>Username</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </label>

                {usernameError && <p className="auth-error">{usernameError}</p>}
                {usernameSuccess && <p className="auth-success">{usernameSuccess}</p>}

                <button type="submit" className="btn btn-primary btn-wide" disabled={savingUsername}>
                  Save username
                </button>
              </form>
            </>
          )}
        </div>

        <div className="profile-card">
          <h2>Change password</h2>
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <label className="field">
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>

            {passwordError && <p className="auth-error">{passwordError}</p>}
            {passwordSuccess && <p className="auth-success">{passwordSuccess}</p>}

            <button type="submit" className="btn btn-primary btn-wide" disabled={savingPassword}>
              Update password
            </button>
          </form>
        </div>

        <div className="profile-card">
          <h2>Tweet visibility</h2>
          <p className="profile-visibility-status">
            {tweetsVisible
              ? 'Your tweets are visible to other users.'
              : 'Your tweets are hidden from other users. Only you can see them.'}
          </p>

          {visibilityError && <p className="auth-error">{visibilityError}</p>}

          <button
            type="button"
            className={`btn btn-wide ${tweetsVisible ? 'btn-outline' : 'btn-primary'}`}
            onClick={handleToggleVisibility}
            disabled={savingVisibility || loading}
          >
            {savingVisibility
              ? 'Saving…'
              : tweetsVisible
                ? 'Hide my tweets from everyone'
                : 'Make my tweets visible again'}
          </button>
        </div>
      </div>
    </div>
  )
}
