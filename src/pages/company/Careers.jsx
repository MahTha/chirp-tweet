import ContentPage from '../../components/ContentPage'

export default function Careers() {
  return (
    <ContentPage title="Careers at Chirp" subtitle="Help us build the future of Chirp">
      <h2>Life at Chirp</h2>
      <p>
        We're a small team obsessed with building a fast, clean, and
        delightful social experience. We move quickly, ship often, and care
        deeply about craft.
      </p>

      <h2>Open roles</h2>
      <ul>
        <li>Frontend Engineer — React</li>
        <li>Backend Engineer — APIs &amp; Infrastructure</li>
        <li>Product Designer</li>
      </ul>
      <p>
        Don't see a fit? We're always happy to hear from people who are
        passionate about Chirp.
      </p>

      <h2>How to apply</h2>
      <p>
        Send your resume and a short note about why you're interested to{' '}
        <a href="mailto:careers@chirp.example">careers@chirp.example</a>.
      </p>
    </ContentPage>
  )
}
