import { updateTweetVisibility } from '../lib/auth'

export default function TweetVisibilityToggle({ tweet, onToggled }) {
  async function handleClick() {
    const result = await updateTweetVisibility({ tweetId: tweet.id, visible: !tweet.is_visible })
    if (result.ok) {
      onToggled(tweet.id, result.isVisible)
    }
  }

  return (
    <button type="button" className={`tweet-visibility-toggle${tweet.is_visible ? ' tweet-visibility-toggle-on' : ''}`} role='switch' aria-checked={tweet.is_visible} title={tweet.is_visible ? 'Visible - click to hide' : 'Hidden - click to unhide'} onClick={handleClick}>
      <span className='tweet-visibility-toggle-thumb'/>
    </button>
  )
}
