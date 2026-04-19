import apiClient from './client';

/**
 * POST /collaborations — invite a collaborator on a post or reel you own.
 * Backend validates ownership of `content_id` and enforces split totals.
 */
export async function createCollaborationInvite(payload: {
  contentType: 'post' | 'reel';
  contentId: string;
  inviteeId: string;
  message?: string;
}): Promise<void> {
  await apiClient.post('/collaborations', {
    content_type: payload.contentType,
    content_id: payload.contentId.trim(),
    invitee_id: payload.inviteeId.trim(),
    message: payload.message?.trim() || undefined,
    watchtime_split: { inviter_percent: 50, invitee_percent: 50 },
    revenue_split: { inviter_percent: 50, invitee_percent: 50 },
  });
}
