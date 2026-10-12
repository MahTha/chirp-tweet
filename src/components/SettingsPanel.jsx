import { useEffect, useState } from "react";
import { fetchProfile, updateTweetsVisibility} from '../lib/auth'
import { useTheme } from "../context/ThemeContext";
import './SettingsPanel.css'

export default function SettingsPanel() {
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'
    const [tweetsVisible, setTweetsVisible] = useState(true)
    const [loadingVisibility, setLoadingVisibility] = useState(true)
    const [savingVisibility, setSavingVisibility] = useState(false)
    const [visibilityError, setVisibilityError] = useState('')

    useEffect(() => {
    fetchProfile().then((result) => {
        if (result.ok) setTweetsVisible(result.profile.tweets_visible)
        setLoadingVisibility(false)
    })
    }, [])

    async function handleToggleTweetsVisibility() {
    setVisibilityError('')
    setSavingVisibility(true)

    const result = await updateTweetsVisibility({ visible: !tweetsVisible })
    setSavingVisibility(false)

    if (result.ok) {
        setTweetsVisible(result.tweetsVisible)
    } else {
        setVisibilityError(result.error)
    }
    }
    
    return (
        <div className="settings-panel">
            <h2>Settings</h2>
            <section className="settings-section">
                <h3>Display</h3>
                <div className="settings-row">
                    <div>
                        <strong>Hide My Tweets</strong>
                        <p>Hide all of your tweets from other users. You can still see them yourself.</p>
                    </div>
                    <button
                        type="button"
                        className={`settings-switch${!tweetsVisible ? ' settings-switch-on' : ''}`}
                        role="switch"
                        aria-checked={!tweetsVisible}
                        onClick={handleToggleTweetsVisibility}
                        disabled={loadingVisibility || savingVisibility}
                    >
                        <span className="settings-switch-thumb" />
                    </button>
                </div>
                {visibilityError && <p className="settings-error">{visibilityError}</p>}

                <div className="settings-row">
                    <div>
                        <strong>Dark Mode</strong>
                        <p>Switch between light and dark themes.</p>
                    </div>
                    <button type="button" className={`settings-switch${isDark ? ' settings-switch-on' : ''}`} role="switch" aria-checked={isDark} onClick={toggleTheme}>
                        <span className="settings-switch-thumb" />
                    </button>
                </div>
            </section>

            <section className="settings-section">
                <h3>Sound</h3>
                <p className="home-card-status">Coming soon</p>
            </section>
        </div>
    )
}