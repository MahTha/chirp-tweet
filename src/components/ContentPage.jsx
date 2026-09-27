import './ContentPage.css'

export default function ContentPage({ title, subtitle, children }) {
  return (
    <div className="content-page">
      <div className="content-card">
        <h1>{title}</h1>
        {subtitle && <p className="content-subtitle">{subtitle}</p>}
        <div className="content-body">{children}</div>
      </div>
    </div>
  )
}
