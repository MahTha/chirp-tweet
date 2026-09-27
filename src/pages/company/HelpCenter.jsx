import ContentPage from '../../components/ContentPage'

export default function HelpCenter() {
  return (
    <ContentPage title="Help Center" subtitle="Answers to common questions">
      <h2>Getting started</h2>
      <p>
        Create an account from the <strong>Sign up</strong> page, then log in
        to see your home feed. You can post an update any time using the
        composer at the top of your timeline.
      </p>

      <h2>How do I reset my password?</h2>
      <p>Password recovery isn't available in this preview yet.</p>

      <h2>How do I switch between light and dark mode?</h2>
      <p>
        Use the toggle button in the bottom-right corner of the screen — it's
        available on every page and remembers your choice.
      </p>

      <h2>How do I delete a post?</h2>
      <p>
        Post management (editing and deleting tweets) is on our roadmap and
        isn't available yet in this version of Chirp.
      </p>

      <h2>Still need help?</h2>
      <p>
        Reach out to our support team at{' '}
        <a href="mailto:support@chirp.example">support@chirp.example</a> and
        we'll get back to you.
      </p>
    </ContentPage>
  )
}
