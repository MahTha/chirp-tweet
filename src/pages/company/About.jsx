import ContentPage from '../../components/ContentPage'

export default function About() {
  return (
    <ContentPage title="About Chirp" subtitle="What we're building, and why">
      <h2>Our mission</h2>
      <p>
        Chirp exists to give everyone a simple, fast place to share what's
        happening and see what the world is talking about, in real time.
      </p>

      <h2>What is Chirp</h2>
      <p>
        Chirp is a lightweight, Twitter-style social feed. Post short updates,
        follow the conversations you care about, and keep up with what's
        trending — all in one clean timeline.
      </p>

      <h2>Where we are today</h2>
      <p>
        Chirp is currently an early, frontend-only preview: the look and feel
        of the product, ready for real accounts and a live backend to be
        connected behind it.
      </p>

      <h2>Get in touch</h2>
      <p>
        Have feedback or an idea for Chirp? We'd love to hear from you at{' '}
        <a href="mailto:hello@chirp.example">hello@chirp.example</a>.
      </p>
    </ContentPage>
  )
}
