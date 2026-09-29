import { updateTweetVisibility } from '../lib/auth'

export default function TweetVisibilityToggle({ tweet, onToggled }) {
  async function handleClick() {
    const result = await updateTweetVisibility({ tweetId: tweet.id, visible: !tweet.is_visible })
    if (result.ok) {
      onToggled(tweet.id, result.isVisible)
    }
  }

  return (
    <button type="button" className="tweet-visibility-toggle" onClick={handleClick}>
      {tweet.is_visible ? 'Hide' : 'Unhide'}
    </button>
  )
}
