import ContentPage from '../../components/ContentPage'

export default function AdsInfo() {
  return (
    <ContentPage title="Ads Info" subtitle="How advertising works on Chirp">
      <h2>Do we show ads?</h2>
      <p>
        Chirp does not currently display advertising. This page describes the
        principles we intend to follow if and when ads are introduced.
      </p>

      <h2>Our approach</h2>
      <ul>
        <li>We will never sell your personal information to advertisers</li>
        <li>Ads will always be clearly labeled as sponsored content</li>
        <li>You will have controls to manage your ad preferences</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        Once advertising controls are available, you'll be able to manage
        them from your account settings.
      </p>

      <h2>Questions</h2>
      <p>
        For questions about advertising on Chirp, contact{' '}
        <a href="mailto:ads@chirp.example">ads@chirp.example</a>.
      </p>
    </ContentPage>
  )
}
