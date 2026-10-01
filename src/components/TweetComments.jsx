import { useState } from "react";
import { fetchComments, postComment } from "../lib/comments";

export default function TweetComments({ tweet }) {
    const [expanded, setExpanded] = useState(false)
    const [comments, setComments] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [commentText, setCommentText] = useState('')
    const [posting, setPosting] = useState(false)
    const [postError, setPostError] = useState('')

    async function handleToggle() {
        if (!expanded && comments == null) {
            setLoading(true)
            setError('')
            const result = await fetchComments(tweet.id)
            setLoading(false)
            if(result.ok) {
                setComments(result.comments)
            } else {
                setError(result.error)
            }
        }
        setExpanded((prev) => !prev)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const trimmed = commentText.trim()
        if (!trimmed || posting) return

        setPosting(true)
        setPostError('')
        const result = await postComment(tweet.id, trimmed)
        setPosting(false)

        if (result.ok) {
        setCommentText('')
        setComments((prev) => [...(prev ?? []), result.comment])
        } else {
        setPostError(result.error)
        }
    }
    const count = comments !== null ? comments.length : tweet.comment_count

  return (
    <div className="tweet-comments">
      <button type="button" className="tweet-comments-toggle" onClick={handleToggle}>
        {expanded ? 'Hide comments' : `View comments (${count})`}
      </button>

      {expanded && (
        <div className="tweet-comments-body">
          {loading && <p className="tweet-comments-status">Loading comments…</p>}
          {!loading && error && <p className="tweet-comments-status">{error}</p>}
          {!loading && !error && comments.length === 0 && (
            <p className="tweet-comments-status">No comments yet</p>
          )}
          {!loading && !error && comments.length > 0 && (
            <ul className="comment-list">
              {comments.map((comment) => (
                <li key={comment.id} className="comment">
                  <strong>{comment.username}</strong>
                  <p>{comment.content}</p>
                </li>
              ))}
            </ul>
          )}

          <form className="comment-composer" onSubmit={handleSubmit}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              maxLength={280}
            />
            {postError && <p className="tweet-comments-status">{postError}</p>}
            <button type="submit" className="btn btn-primary" disabled={!commentText.trim() || posting}>
              {posting ? 'Posting…' : 'Reply'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}