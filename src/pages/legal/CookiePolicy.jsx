import ContentPage from '../../components/ContentPage'

export default function CookiePolicy() {
  return (
    <ContentPage title="Cookie Policy" subtitle="Last updated: September 24, 2026">
      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files stored on your device that help websites
        remember information about your visit, such as your preferences and
        login state.
      </p>

      <h2>2. How Chirp Uses Cookies</h2>
      <p>We use cookies and similar technologies (such as local storage) to:</p>
      <ul>
        <li>Keep you signed in between visits</li>
        <li>Remember your display preferences, such as light or dark mode</li>
        <li>Understand how the service is used so we can improve it</li>
        <li>Keep the service secure</li>
      </ul>

      <h2>3. Types of Cookies We Use</h2>
      <ul>
        <li>
          <strong>Essential cookies</strong> — required for the service to
          function, such as maintaining your login session
        </li>
        <li>
          <strong>Preference cookies</strong> — remember choices you make,
          like your theme setting
        </li>
        <li>
          <strong>Analytics cookies</strong> — help us understand usage
          patterns so we can improve Chirp
        </li>
      </ul>

      <h2>4. Managing Cookies</h2>
      <p>
        Most browsers let you control cookies through their settings,
        including blocking or deleting them. Disabling essential cookies may
        prevent parts of Chirp from working correctly.
      </p>

      <h2>5. Third-Party Cookies</h2>
      <p>
        We do not currently use third-party advertising cookies. If this
        changes, we will update this policy accordingly.
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time to reflect changes
        in the technology we use or for legal reasons.
      </p>

      <h2>7. Contact Us</h2>
      <p>
        Questions about our use of cookies can be sent to{' '}
        <a href="mailto:privacy@chirp.example">privacy@chirp.example</a>.
      </p>
    </ContentPage>
  )
}
