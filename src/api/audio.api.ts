import apiClient from './client';

export interface AudioTrack {
  _id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl?: string;
  durationMs: number;
  genre?: string;
  usageCount: number;
}

const mapTrack = (t: any): AudioTrack => ({
  _id: String(t._id ?? t.id ?? ''),
  title: String(t.title ?? 'Unknown'),
  artist: String(t.artist ?? 'Unknown'),
  audioUrl: String(t.audio_url ?? t.audioUrl ?? ''),
  coverUrl: t.cover_url ?? t.coverUrl ?? undefined,
  durationMs: Math.round(Number(t.duration ?? 0) * 1000),
  genre: t.genre ?? undefined,
  usageCount: Number(t.usage_count ?? t.usageCount ?? 0),
});

/** GET /audio/trending */
export async function getTrendingAudio(limit = 20): Promise<AudioTrack[]> {
  const { data } = await apiClient.get('/audio/trending', { params: { limit } });
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return list.map(mapTrack);
}

/** GET /audio/search?q= */
export async function searchAudio(query: string, limit = 20): Promise<AudioTrack[]> {
  const { data } = await apiClient.get('/audio/search', { params: { q: query, limit } });
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return list.map(mapTrack);
}
