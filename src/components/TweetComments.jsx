import { useState } from "react";
import { fetchComments, postComment } from "../lib/comments";
import { formatRelativeTime } from '../lib/dashboard'

function groupByParent(comments) {
  const groups = new Map()
  comments.forEach((comment) => {
    const key = comment.parent_comment_id ?? 'root'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(comment)
  })
  return groups
}

function CommentNode({ comment, groups, onReply }) {
  const replies = groups.get(comment.id) ?? []
  return (
    <li className="comment">
      <strong>{comment.username}</strong>
      <span className="tweet-time"> . {formatRelativeTime(comment.created_at)}</span>
      <p>{comment.content}</p>
      <button type="button" className="comment-reply-btn" onClick={() => onReply(comment)}>
        Reply
      </button>
      {replies.length > 0 && (
        <ul className="comment-list comment-replies">
          {replies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} groups={groups} onReply={onReply} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TweetComments({ tweet }) {
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)

  async function handleToggle() {
    if (!expanded && comments == null) {
      setLoading(true)
      setError('')
      const result = await fetchComments(tweet.id)
      setLoading(false)
      if (result.ok) {
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
    const result = await postComment(tweet.id, trimmed, replyingTo?.id ?? null)
    setPosting(false)

    if (result.ok) {
      setCommentText('')
      setReplyingTo(null)
      setComments((prev) => [...(prev ?? []), result.comment])
    } else {
      setPostError(result.error)
    }
  }
  const count = comments !== null ? comments.length : tweet.comment_count

  return (
    <div className="tweet-comments">
      <button type="button" className="tweet-comments-toggle" onClick={handleToggle}>
        {expanded ? 'Hide comments' : `${count} ${count === 1 ? 'Comment' : 'Comments'}`}
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
              {groupByParent(comments).get('root')?.map((comment) => (
                <CommentNode key={comment.id} comment={comment} groups={groupByParent(comments)} onReply={setReplyingTo} />
              ))}
            </ul>
          )}

          {replyingTo && (
              <p className="comment-replying-to">
                Replying to <strong>@{replyingTo.username}</strong>{' '}
                <button type="button" className="comment-cancel-reply" onClick={() => setReplyingTo(null)}>
                  Cancel
                </button>
              </p>
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