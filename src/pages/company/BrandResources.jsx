import ContentPage from '../../components/ContentPage'

export default function BrandResources() {
  return (
    <ContentPage title="Brand Resources" subtitle="Using the Chirp name and logo">
      <h2>Our name and logo</h2>
      <p>
        The Chirp name, logo, and bird mark are the property of Chirp Corp.
        These guidelines explain how they may be used.
      </p>

      <h2>Do</h2>
      <ul>
        <li>Use the logo at its original proportions and colors</li>
        <li>Leave clear space around the logo so it isn't crowded</li>
        <li>Reference "Chirp" as a proper noun, capitalized</li>
      </ul>

      <h2>Don't</h2>
      <ul>
        <li>Stretch, recolor, or rotate the logo</li>
        <li>Combine the logo with other marks or icons</li>
        <li>Use the Chirp name to imply endorsement without permission</li>
      </ul>

      <h2>Requesting assets</h2>
      <p>
        For press kits or approved logo files, contact{' '}
        <a href="mailto:brand@chirp.example">brand@chirp.example</a>.
      </p>
    </ContentPage>
  )
}
