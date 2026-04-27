import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Server {
  _id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  ownerId: string;
  memberCount: number;
  inviteCode: string;
  isPublic: boolean;
  categories: string[];
  rules: string;
  isMember?: boolean;
  isOwner?: boolean;
  createdAt: string;
}

export interface ServerChannel {
  _id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice' | 'announcement';
  topic: string;
  position: number;
  isArchived: boolean;
}

export interface ServerMessage {
  _id: string;
  channelId: string;
  authorId: string;
  authorUsername: string;
  authorAvatar: string | null;
  text: string;
  createdAt: string;
}

export interface ServerMember {
  _id: string;
  userId: string;
  username: string;
  profilePicture: string | null;
  fullName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

const mapServer = (s: any): Server => ({
  _id: String(s._id ?? s.id ?? ''),
  name: s.name ?? '',
  description: s.description ?? '',
  iconUrl: s.icon_url ?? s.iconUrl ?? null,
  bannerUrl: s.banner_url ?? s.bannerUrl ?? null,
  ownerId: String(s.owner_id ?? s.ownerId ?? ''),
  memberCount: Number(s.member_count ?? s.memberCount ?? 0),
  inviteCode: s.invite_code ?? s.inviteCode ?? '',
  isPublic: Boolean(s.is_public ?? s.isPublic ?? true),
  categories: Array.isArray(s.categories) ? s.categories : [],
  rules: s.rules ?? '',
  isMember: Boolean(s.is_member ?? s.isMember ?? false),
  isOwner: Boolean(s.is_owner ?? s.isOwner ?? false),
  createdAt: s.created_at ?? s.createdAt ?? '',
});

const mapChannel = (c: any): ServerChannel => ({
  _id: String(c._id ?? c.id ?? ''),
  serverId: String(c.server_id ?? c.serverId ?? ''),
  name: c.name ?? '',
  type: c.type ?? 'text',
  topic: c.topic ?? '',
  position: Number(c.position ?? 0),
  isArchived: Boolean(c.is_archived ?? c.isArchived ?? false),
});

const mapMessage = (m: any): ServerMessage => {
  const author = m.author ?? m.author_id ?? {};
  const authorObj = typeof author === 'object' && author !== null ? author : {};
  return {
    _id: String(m._id ?? m.id ?? ''),
    channelId: String(m.channel_id ?? m.channelId ?? ''),
    authorId: String(authorObj._id ?? authorObj.id ?? m.author_id ?? ''),
    authorUsername: authorObj.username ?? m.author_username ?? '',
    authorAvatar: authorObj.profile_picture ?? authorObj.profilePicture ?? authorObj.avatar_url ?? null,
    text: m.text ?? (typeof m.content === 'object' && m.content !== null ? m.content.text : m.content) ?? '',
    createdAt: m.created_at ?? m.createdAt ?? '',
  };
};

const mapMember = (m: any): ServerMember => {
  const user = m.user ?? m.user_id ?? {};
  const userObj = typeof user === 'object' && user !== null ? user : {};
  return {
    _id: String(m._id ?? m.id ?? ''),
    userId: String(userObj._id ?? userObj.id ?? m.user_id ?? ''),
    username: userObj.username ?? '',
    profilePicture: userObj.profile_picture ?? userObj.profilePicture ?? null,
    fullName: userObj.full_name ?? userObj.fullName ?? '',
    role: m.role ?? 'member',
    joinedAt: m.joined_at ?? m.joinedAt ?? m.created_at ?? '',
  };
};

// ─── Endpoints ────────────────────────────────────────────────────────────────

/** GET /servers/mine */
export async function getMyServers(): Promise<{ servers: Server[]; hasMore: boolean; cursor: string | null }> {
  const { data } = await apiClient.get('/servers/mine');
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return {
    servers: list.map(mapServer),
    hasMore: Boolean(data.meta?.has_more),
    cursor: data.meta?.cursor ?? null,
  };
}

/** GET /servers/discover?cursor=&limit= */
export async function discoverServers(cursor?: string | null, limit = 20): Promise<{ servers: Server[]; hasMore: boolean; cursor: string | null }> {
  const { data } = await apiClient.get('/servers/discover', {
    params: { cursor: cursor ?? undefined, limit },
  });
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return {
    servers: list.map(mapServer),
    hasMore: Boolean(data.meta?.has_more),
    cursor: data.meta?.cursor ?? null,
  };
}

/** GET /servers/:serverId */
export async function getServer(serverId: string): Promise<Server> {
  const { data } = await apiClient.get(`/servers/${serverId}`);
  return mapServer(data.data);
}

/** POST /servers */
export async function createServer(payload: {
  name: string;
  description?: string;
  isPublic?: boolean;
  categories?: string[];
  rules?: string;
}): Promise<Server> {
  const { data } = await apiClient.post('/servers', {
    name: payload.name,
    description: payload.description ?? '',
    is_public: payload.isPublic ?? true,
    categories: payload.categories ?? [],
    rules: payload.rules ?? '',
  });
  return mapServer(data.data);
}

/** PUT /servers/:serverId */
export async function updateServer(serverId: string, payload: {
  name?: string;
  description?: string;
  isPublic?: boolean;
  categories?: string[];
  rules?: string;
}): Promise<Server> {
  const { data } = await apiClient.put(`/servers/${serverId}`, {
    name: payload.name,
    description: payload.description,
    is_public: payload.isPublic,
    categories: payload.categories,
    rules: payload.rules,
  });
  return mapServer(data.data);
}

/** DELETE /servers/:serverId */
export async function deleteServer(serverId: string): Promise<void> {
  await apiClient.delete(`/servers/${serverId}`);
}

/** POST /servers/:serverId/join */
export async function joinServer(serverId: string): Promise<void> {
  await apiClient.post(`/servers/${serverId}/join`);
}

/** POST /servers/:serverId/leave */
export async function leaveServer(serverId: string): Promise<void> {
  await apiClient.post(`/servers/${serverId}/leave`);
}

/** POST /servers/join/:inviteCode */
export async function joinByInviteCode(inviteCode: string): Promise<{ serverId: string; serverName: string }> {
  const { data } = await apiClient.post(`/servers/join/${inviteCode}`);
  return {
    serverId: String(data.data?.serverId ?? data.data?.server_id ?? ''),
    serverName: String(data.data?.serverName ?? data.data?.server_name ?? ''),
  };
}

/** GET /servers/:serverId/members */
export async function getMembers(serverId: string, cursor?: string | null): Promise<{ members: ServerMember[]; hasMore: boolean; cursor: string | null }> {
  const { data } = await apiClient.get(`/servers/${serverId}/members`, {
    params: { cursor: cursor ?? undefined },
  });
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return {
    members: list.map(mapMember),
    hasMore: Boolean(data.meta?.has_more),
    cursor: data.meta?.cursor ?? null,
  };
}

/** GET /servers/:serverId/channels */
export async function getChannels(serverId: string): Promise<ServerChannel[]> {
  const { data } = await apiClient.get(`/servers/${serverId}/channels`);
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return list.map(mapChannel).sort((a, b) => a.position - b.position);
}

/** POST /servers/:serverId/channels */
export async function createChannel(serverId: string, payload: {
  name: string;
  type?: 'text' | 'voice' | 'announcement';
  topic?: string;
}): Promise<ServerChannel> {
  const { data } = await apiClient.post(`/servers/${serverId}/channels`, {
    name: payload.name,
    type: payload.type ?? 'text',
    topic: payload.topic ?? '',
  });
  return mapChannel(data.data);
}

/** GET /servers/:serverId/channels/:channelId/messages */
export async function getChannelMessages(
  serverId: string,
  channelId: string,
  cursor?: string | null,
  limit = 50,
): Promise<{ messages: ServerMessage[]; hasMore: boolean; cursor: string | null }> {
  const { data } = await apiClient.get(`/servers/${serverId}/channels/${channelId}/messages`, {
    params: { cursor: cursor ?? undefined, limit },
  });
  const list: any[] = Array.isArray(data.data) ? data.data : [];
  return {
    messages: list.map(mapMessage),
    hasMore: Boolean(data.meta?.has_more),
    cursor: data.meta?.cursor ?? null,
  };
}

/** POST /servers/:serverId/channels/:channelId/messages */
export async function sendChannelMessage(
  serverId: string,
  channelId: string,
  text: string,
): Promise<ServerMessage> {
  const { data } = await apiClient.post(
    `/servers/${serverId}/channels/${channelId}/messages`,
    { text },
  );
  return mapMessage(data.data);
}
