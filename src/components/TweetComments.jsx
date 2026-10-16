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

function ReplyForm({ placeholder, onSubmit, onCancel }) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || posting) return

    setPosting(true)
    setError('')
    const result = await onSubmit(trimmed)
    setPosting(false)

    if (result.ok) {
      setText('')
    } else {
      setError(result.error)
    }
  }

  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={280}
      />
      {error && <p className="tweet-comments-status">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={!text.trim() || posting}>
        {posting ? 'Posting…' : 'Reply'}
      </button>
      {onCancel && (
        <button type="button" className="comment-cancel-reply" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}

function CommentNode({ comment, groups, replyingToId, onReply, onCancelReply, onSubmitReply }) {
  const replies = groups.get(comment.id) ?? []
  const isReplying = replyingToId === comment.id

  return (
    <li className="comment">
      <strong>{comment.username}</strong>
      <span className="tweet-time"> . {formatRelativeTime(comment.created_at)}</span>
      <p>{comment.content}</p>
      <button type="button" className="comment-reply-btn" onClick={() => onReply(comment)}>
        Reply
      </button>

      {isReplying && (
        <ReplyForm
          placeholder={`Reply to @${comment.username}…`}
          onSubmit={(text) => onSubmitReply(text, comment.id)}
          onCancel={onCancelReply}
        />
      )}

      {replies.length > 0 && (
        <ul className="comment-list comment-replies">
          {replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              groups={groups}
              replyingToId={replyingToId}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onSubmitReply={onSubmitReply}
            />
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

  async function handlePostComment(text, parentId) {
    const result = await postComment(tweet.id, text, parentId)
    if (result.ok) {
      setComments((prev) => [...(prev ?? []), result.comment])
      setReplyingTo(null)
    }
    return result
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
                <CommentNode
                  key={comment.id}
                  comment={comment}
                  groups={groupByParent(comments)}
                  replyingToId={replyingTo?.id ?? null}
                  onReply={setReplyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  onSubmitReply={(text, parentId) => handlePostComment(text, parentId)}
                />
              ))}
            </ul>
          )}

          {replyingTo === null && (
            <ReplyForm placeholder="Write a comment…" onSubmit={(text) => handlePostComment(text, null)} />
          )}
        </div>
      )}
    </div>
  )
}