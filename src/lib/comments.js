import {apiFetch} from './api.js'

export async function fetchComments(tweetId) {
    const result = await apiFetch(`/api/tweets/${tweetId}/comments`)
    return result.ok ? {ok: true, comments: result.data.comments } : result
}

export async function postComment(tweetId, content) {
    const result = await apiFetch(`/api/tweets/${tweetId}/comments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json' },
        body: JSON.stringify({ content}),
    })
    return result.ok ? { ok: true, comment: result.data.comment } : result
}