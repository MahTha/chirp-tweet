import ContentPage from '../../components/ContentPage'

export default function Accessibility() {
  return (
    <ContentPage title="Accessibility" subtitle="Our commitment to an accessible Chirp">
      <h2>Our commitment</h2>
      <p>
        We want Chirp to be usable by everyone, regardless of ability. We aim
        to meet the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
        as we continue building the product.
      </p>

      <h2>What we're doing</h2>
      <ul>
        <li>Using semantic HTML and labeled form fields throughout the app</li>
        <li>Ensuring interactive elements are reachable by keyboard</li>
        <li>Maintaining sufficient color contrast in both light and dark mode</li>
        <li>Testing layouts down to small mobile screen widths</li>
      </ul>

      <h2>Known limitations</h2>
      <p>
        Chirp is an early, frontend-only preview, so some areas (such as
        screen-reader announcements for new tweets) are still being refined.
      </p>

      <h2>Feedback</h2>
      <p>
        If you encounter an accessibility barrier while using Chirp, please
        let us know at{' '}
        <a href="mailto:accessibility@chirp.example">accessibility@chirp.example</a>{' '}
        so we can address it.
      </p>
    </ContentPage>
  )
}
