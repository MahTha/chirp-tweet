import ContentPage from '../../components/ContentPage'

export default function Developers() {
  return (
    <ContentPage title="Chirp Developers" subtitle="Build on top of Chirp">
      <h2>Overview</h2>
      <p>
        We're planning a public API so developers can build bots,
        integrations, and tools on top of Chirp. This page will host our
        developer documentation once the API is available.
      </p>

      <h2>What's coming</h2>
      <ul>
        <li>Read and post tweets programmatically</li>
        <li>Subscribe to real-time updates via webhooks</li>
        <li>OAuth-based authentication for third-party apps</li>
      </ul>

      <h2>Get notified</h2>
      <p>
        Want early access when the API launches? Email{' '}
        <a href="mailto:developers@chirp.example">developers@chirp.example</a>{' '}
        and we'll keep you posted.
      </p>
    </ContentPage>
  )
}
