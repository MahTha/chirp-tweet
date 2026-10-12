import { useTheme } from "../context/ThemeContext";
import './SettingsPanel.css'

export default function SettingsPanel() {
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <div className="settings-panel">
            <h2>Settings</h2>
            <section className="settings-section">
                <h3>Display</h3>
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