/**
 * Comprehensive dummy/fallback data for the entire app.
 * Used when the backend is unreachable — every screen stays fully functional.
 *
 * Images use picsum.photos seeded URLs for consistent, beautiful placeholders.
 */

import type { Post, PostAuthor, PaginatedPosts, PostMedia } from '../api/post.api';
import type { StoryGroup, Story } from '../api/story.api';
import type { Reel } from '../api/reel.api';
import type { UserProfile, UserSearchResult, PostThumbnail } from '../api/user.api';
import type { Conversation, ChatMessage, ChatParticipant } from '../api/chat.api';
import type { Notification } from '../api/notification.api';
import type { Comment } from '../api/comment.api';
import type { FollowRequest } from '../api/follow.api';
import type { AuthUser } from '../stores/authStore';

/* ═══════════════════════════════════════════════════════
   SEED HELPERS
   ═══════════════════════════════════════════════════════ */

const img = (seed: number, w = 640, h = 640) =>
  `https://picsum.photos/seed/insta${seed}/${w}/${h}`;

const avatar = (seed: number) =>
  `https://i.pravatar.cc/200?img=${seed}`;

const pastDate = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 3600_000).toISOString();

/* ═══════════════════════════════════════════════════════
   USERS / AUTHORS
   ═══════════════════════════════════════════════════════ */

export const DEMO_USER: AuthUser = {
  _id: 'demo_user_001',
  username: 'alex.creates',
  email: 'alex@instayt.app',
  fullName: 'Alex Morgan',
  profilePicture: avatar(1),
  bio: '📸 Photographer & Creator\n🌍 Travel · Lifestyle · Art\n✨ Turning moments into memories',
  website: 'alexmorgan.com',
  isVerified: true,
  isPrivate: false,
  followersCount: 12453,
  followingCount: 843,
  postsCount: 284,
};

export const AUTHORS: PostAuthor[] = [
  { _id: 'u1', username: 'sarah.lens', fullName: 'Sarah Chen', profilePicture: avatar(5), isVerified: true },
  { _id: 'u2', username: 'mike_travels', fullName: 'Mike Johnson', profilePicture: avatar(8), isVerified: false },
  { _id: 'u3', username: 'luna.art', fullName: 'Luna Martinez', profilePicture: avatar(9), isVerified: true },
  { _id: 'u4', username: 'jaydev.codes', fullName: 'Jay Patel', profilePicture: avatar(11), isVerified: false },
  { _id: 'u5', username: 'emma.wild', fullName: 'Emma Wilson', profilePicture: avatar(16), isVerified: true },
  { _id: 'u6', username: 'noah.fit', fullName: 'Noah Kim', profilePicture: avatar(12), isVerified: false },
  { _id: 'u7', username: 'zoe.eats', fullName: 'Zoe Taylor', profilePicture: avatar(20), isVerified: true },
  { _id: 'u8', username: 'liam.music', fullName: 'Liam Brooks', profilePicture: avatar(13), isVerified: false },
  { _id: 'u9', username: 'ava.design', fullName: 'Ava Rodriguez', profilePicture: avatar(25), isVerified: true },
  { _id: 'u10', username: 'oliver.tech', fullName: 'Oliver Lee', profilePicture: avatar(15), isVerified: false },
  { _id: 'u11', username: 'mia.yoga', fullName: 'Mia Thompson', profilePicture: avatar(23), isVerified: false },
  { _id: 'u12', username: 'ethan.photo', fullName: 'Ethan Brown', profilePicture: avatar(14), isVerified: true },
];

/* ═══════════════════════════════════════════════════════
   POSTS
   ═══════════════════════════════════════════════════════ */

const CAPTIONS = [
  'Golden hour never disappoints ✨ #photography #sunset',
  'Lost in the streets of Kyoto 🏯🇯🇵',
  'New work in progress — can\'t wait to share the final piece 🎨',
  'Morning coffee and code. Life is good ☕️💻',
  'The mountains are calling and I must go 🏔️',
  'Fresh recipe alert! This one\'s a game changer 🍝',
  'Studio session vibes 🎵 New track dropping soon',
  'Design is not just what it looks like. Design is how it works. 🎯',
  'Weekend adventures with the best crew 🚀',
  'Minimalism is the ultimate sophistication ✨',
  'Sunset swim 🌊 This is what living feels like',
  'Behind the scenes of today\'s shoot 📸',
  'Nature never goes out of style 🌿',
  'City lights, long nights 🌃',
  'Art is the lie that enables us to realize the truth 🖼️',
  'Home is wherever I\'m with you 🏠❤️',
  'Exploring hidden gems in Barcelona 🇪🇸',
  'Workout done. Feeling unstoppable 💪',
  'Color palette of today 🎨',
  'The journey is the destination 🛤️',
];

function makePost(index: number): Post {
  const author = AUTHORS[index % AUTHORS.length];
  const hoursAgo = index * 3 + 1;
  const hasManyMedia = index % 4 === 0;

  const media: PostMedia[] = [
    {
      type: 'image',
      url: img(100 + index, 1080, index % 3 === 0 ? 1350 : 1080),
      thumbnail: null,
      width: 1080,
      height: index % 3 === 0 ? 1350 : 1080,
    },
  ];

  if (hasManyMedia) {
    media.push(
      { type: 'image', url: img(200 + index, 1080, 1080), thumbnail: null, width: 1080, height: 1080 },
      { type: 'image', url: img(300 + index, 1080, 1080), thumbnail: null, width: 1080, height: 1080 },
    );
  }

  return {
    _id: `post_${index}`,
    author,
    caption: CAPTIONS[index % CAPTIONS.length],
    media,
    likesCount: 120 + index * 47,
    commentsCount: 8 + index * 3,
    viewsCount: 500 + index * 120,
    tags: ['photography', 'lifestyle', 'art'].slice(0, (index % 3) + 1),
    location: index % 3 === 0 ? { name: ['Paris, France', 'Tokyo, Japan', 'New York City', 'Barcelona, Spain', 'Bali, Indonesia'][index % 5] } : null,
    commentsDisabled: false,
    hideLikesCount: false,
    isArchived: false,
    createdAt: pastDate(hoursAgo),
    updatedAt: pastDate(hoursAgo),
  };
}

export const DUMMY_POSTS: Post[] = Array.from({ length: 20 }, (_, i) => makePost(i));

export function getDummyFeed(page: number, limit: number): PaginatedPosts {
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    posts: DUMMY_POSTS.slice(start, end),
    hasMore: end < DUMMY_POSTS.length,
    page,
  };
}

export function getDummyExplore(page: number, limit: number): PaginatedPosts {
  // Reversed order for explore
  const reversed = [...DUMMY_POSTS].reverse();
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    posts: reversed.slice(start, end),
    hasMore: end < reversed.length,
    page,
  };
}

export function getDummySavedPosts(): { posts: Post[]; hasMore: boolean } {
  return { posts: DUMMY_POSTS.slice(0, 9), hasMore: false };
}

export function getDummyPost(postId: string): Post {
  return DUMMY_POSTS.find((p) => p._id === postId) || DUMMY_POSTS[0];
}

/* ═══════════════════════════════════════════════════════
   STORIES
   ═══════════════════════════════════════════════════════ */

function makeStoryGroup(author: PostAuthor, index: number): StoryGroup {
  const stories: Story[] = Array.from({ length: 1 + (index % 3) }, (_, si) => ({
    _id: `story_${author._id}_${si}`,
    author,
    media: { type: 'image' as const, url: img(400 + index * 10 + si, 1080, 1920) },
    text: null,
    visibility: 'public' as const,
    viewsCount: 45 + si * 20,
    hasViewed: index > 4,
    createdAt: pastDate(2 + si * 3),
  }));
  return { author, stories, hasViewed: index > 4 };
}

export const DUMMY_STORY_GROUPS: StoryGroup[] = AUTHORS.slice(0, 8).map((a, i) => makeStoryGroup(a, i));

export function getDummyUserStories(userId: string): Story[] {
  const group = DUMMY_STORY_GROUPS.find((g) => g.author._id === userId);
  if (group) return group.stories;
  const author = AUTHORS.find((a) => a._id === userId) || AUTHORS[0];
  return [
    {
      _id: `story_fallback_${userId}`,
      author,
      media: { type: 'image', url: img(500, 1080, 1920) },
      text: null,
      visibility: 'public',
      viewsCount: 120,
      hasViewed: false,
      createdAt: pastDate(1),
    },
  ];
}

/* ═══════════════════════════════════════════════════════
   REELS
   ═══════════════════════════════════════════════════════ */

const REEL_CAPTIONS = [
  'This is how you do it 🔥 #tutorial',
  'Wait for it... 😱 #mindblown',
  'POV: You just discovered something incredible 💡',
  'Quick recipe in under 60 seconds 🍳',
  'This view tho 🤯 #travel #explore',
  'Gym motivation 💪 #fitness #workout',
  'Painting process ✨ #art #timelapse',
  'Street photography walk 📷 #photography',
];

const REEL_AUDIOS = [
  { title: 'Aesthetic Vibes', artist: 'Lo-Fi Beats' },
  { title: 'Trending Sound', artist: 'Viral Audio' },
  { title: 'Original Audio', artist: null },
  { title: 'Summer Feelings', artist: 'Chill Mix' },
  { title: 'Motivation Mix', artist: 'Energy Beats' },
];

function makeReel(index: number): Reel {
  const author = AUTHORS[(index + 3) % AUTHORS.length];
  return {
    _id: `reel_${index}`,
    author,
    caption: REEL_CAPTIONS[index % REEL_CAPTIONS.length],
    video: {
      // Using picsum as thumbnail placeholder (no real video URL for dummy usage)
      url: '',
      thumbnail: img(600 + index, 1080, 1920),
      width: 1080,
      height: 1920,
      duration: 15 + (index % 60),
    },
    audio: REEL_AUDIOS[index % REEL_AUDIOS.length] as any,
    hashtags: ['trending', 'viral', 'fyp'].slice(0, (index % 3) + 1),
    likesCount: 2400 + index * 350,
    commentsCount: 80 + index * 15,
    sharesCount: 24 + index * 8,
    viewsCount: 15000 + index * 2000,
    allowRemix: true,
    createdAt: pastDate(index * 4 + 2),
  };
}

export const DUMMY_REELS: Reel[] = Array.from({ length: 10 }, (_, i) => makeReel(i));

export function getDummyReelsFeed(page: number, limit: number) {
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    reels: DUMMY_REELS.slice(start, end),
    hasMore: end < DUMMY_REELS.length,
  };
}

/* ═══════════════════════════════════════════════════════
   USER PROFILES & SEARCH
   ═══════════════════════════════════════════════════════ */

export const DUMMY_SEARCH_USERS: UserSearchResult[] = AUTHORS.map((a) => ({
  _id: a._id,
  username: a.username,
  fullName: a.fullName,
  profilePicture: a.profilePicture,
  isVerified: a.isVerified,
  followersCount: 1000 + Math.floor(Math.random() * 50000),
}));

export function getDummyUserProfile(username: string): UserProfile {
  const author = AUTHORS.find((a) => a.username === username) || AUTHORS[0];
  const thumbnails: PostThumbnail[] = Array.from({ length: 12 }, (_, i) => ({
    _id: `upost_${author._id}_${i}`,
    media: [{ type: 'image', url: img(700 + parseInt(author._id.replace('u', '')) * 10 + i, 640, 640) }],
    likesCount: 50 + i * 30,
    commentsCount: 5 + i * 2,
    createdAt: pastDate(i * 24 + 12),
  }));

  return {
    _id: author._id,
    username: author.username,
    email: `${author.username}@instayt.app`,
    fullName: author.fullName,
    profilePicture: author.profilePicture,
    bio: `✨ ${author.fullName}\n📍 Creative soul wandering the world\n💫 DM for collabs`,
    website: `${author.username.replace('.', '')}.com`,
    isVerified: author.isVerified,
    isPrivate: false,
    followersCount: 2500 + Math.floor(Math.random() * 30000),
    followingCount: 400 + Math.floor(Math.random() * 800),
    postsCount: thumbnails.length,
    isFollowing: Math.random() > 0.5,
    isFollowedBy: Math.random() > 0.6,
    followStatus: 'accepted',
    recentPosts: thumbnails,
    canViewPosts: true,
  };
}

export function getDummySearchResults(query: string) {
  const q = query.toLowerCase();
  const users = DUMMY_SEARCH_USERS.filter(
    (u) => u.username.includes(q) || u.fullName.toLowerCase().includes(q),
  );
  return { users, hasMore: false };
}

export function getDummyUserFollowers(username: string) {
  return { followers: DUMMY_SEARCH_USERS.slice(0, 8), hasMore: false };
}

export function getDummyUserFollowing(username: string) {
  return { following: DUMMY_SEARCH_USERS.slice(4, 12), hasMore: false };
}

export function getDummyUserPosts(username: string) {
  return {
    posts: DUMMY_POSTS.slice(0, 9).map((p) => ({
      ...p,
      author: AUTHORS.find((a) => a.username === username) || AUTHORS[0],
    })),
    hasMore: false,
  };
}

/* ═══════════════════════════════════════════════════════
   CONVERSATIONS & MESSAGES
   ═══════════════════════════════════════════════════════ */

function makeParticipant(author: PostAuthor): ChatParticipant {
  return {
    _id: author._id,
    username: author.username,
    fullName: author.fullName,
    profilePicture: author.profilePicture,
    isVerified: author.isVerified,
    lastSeen: pastDate(0.5),
  };
}

const MESSAGE_TEXTS = [
  'Hey! How are you doing? 😊',
  'That photo you posted is amazing! 📸',
  'Are you free this weekend?',
  'Just saw your story, looks incredible!',
  'Thanks for the follow! 🙏',
  'Let\'s catch up soon ☕️',
  'Love your latest project!',
  'Have you seen the sunset today? 🌅',
  'Can\'t wait for the collaboration!',
  'That\'s such a great idea 💡',
  'haha sure! Let me know when',
  'Omg yes! Let\'s do it 🎉',
];

function makeConversation(index: number): Conversation {
  const otherUser = AUTHORS[index % AUTHORS.length];
  const lastMsgText = MESSAGE_TEXTS[index % MESSAGE_TEXTS.length];
  return {
    _id: `conv_${index}`,
    participants: [
      makeParticipant({ _id: DEMO_USER._id, username: DEMO_USER.username, fullName: DEMO_USER.fullName, profilePicture: DEMO_USER.profilePicture, isVerified: DEMO_USER.isVerified }),
      makeParticipant(otherUser),
    ],
    isGroup: false,
    lastMessage: {
      _id: `msg_last_${index}`,
      sender: { _id: otherUser._id, username: otherUser.username, fullName: otherUser.fullName, profilePicture: otherUser.profilePicture },
      content: { text: lastMsgText },
      messageType: 'text',
      readBy: index % 3 === 0 ? [{ user: DEMO_USER._id, readAt: pastDate(0.1) }] : [],
      isDeleted: false,
      createdAt: pastDate(index * 2 + 0.5),
    },
    lastActivity: pastDate(index * 2 + 0.5),
    unreadCount: index < 3 ? (3 - index) : 0,
  };
}

export const DUMMY_CONVERSATIONS: Conversation[] = Array.from({ length: 8 }, (_, i) => makeConversation(i));

export function getDummyConversations() {
  return { conversations: DUMMY_CONVERSATIONS, hasMore: false };
}

export function getDummyMessages(conversationId: string): { messages: ChatMessage[]; hasMore: boolean } {
  const conv = DUMMY_CONVERSATIONS.find((c) => c._id === conversationId);
  const otherUser = conv?.participants.find((p) => p._id !== DEMO_USER._id);
  const sender = otherUser
    ? { _id: otherUser._id, username: otherUser.username, fullName: otherUser.fullName, profilePicture: otherUser.profilePicture }
    : { _id: 'u1', username: 'sarah.lens', fullName: 'Sarah Chen', profilePicture: avatar(5) };

  const meSender = { _id: DEMO_USER._id, username: DEMO_USER.username, fullName: DEMO_USER.fullName, profilePicture: DEMO_USER.profilePicture };

  const messages: ChatMessage[] = [
    { _id: `m1_${conversationId}`, sender, content: { text: 'Hey! I saw your latest post, it\'s incredible 🔥' }, messageType: 'text', readBy: [{ user: DEMO_USER._id, readAt: pastDate(3) }], isDeleted: false, createdAt: pastDate(4) },
    { _id: `m2_${conversationId}`, sender: meSender, content: { text: 'Thank you so much! Took me a while to get the right shot 📸' }, messageType: 'text', readBy: [{ user: sender._id, readAt: pastDate(2.8) }], isDeleted: false, createdAt: pastDate(3.5) },
    { _id: `m3_${conversationId}`, sender, content: { text: 'The lighting was perfect! Where was that?' }, messageType: 'text', readBy: [{ user: DEMO_USER._id, readAt: pastDate(2.5) }], isDeleted: false, createdAt: pastDate(3) },
    { _id: `m4_${conversationId}`, sender: meSender, content: { text: 'It was at the old bridge during golden hour. I can take you there sometime!' }, messageType: 'text', readBy: [{ user: sender._id, readAt: pastDate(2.2) }], isDeleted: false, createdAt: pastDate(2.5) },
    { _id: `m5_${conversationId}`, sender, content: { text: 'That would be amazing! I\'d love to shoot there 😍' }, messageType: 'text', readBy: [{ user: DEMO_USER._id, readAt: pastDate(2) }], isDeleted: false, createdAt: pastDate(2.2) },
    { _id: `m6_${conversationId}`, sender: meSender, content: { text: 'Let\'s plan it for this weekend then! ☀️' }, messageType: 'text', readBy: [{ user: sender._id, readAt: pastDate(1.5) }], isDeleted: false, createdAt: pastDate(2) },
    { _id: `m7_${conversationId}`, sender, content: { text: 'Perfect! Saturday morning works for me' }, messageType: 'text', readBy: [{ user: DEMO_USER._id, readAt: pastDate(1) }], isDeleted: false, createdAt: pastDate(1.5) },
    { _id: `m8_${conversationId}`, sender: meSender, content: { text: 'Great, it\'s a date! I\'ll bring my 85mm lens too 📷' }, messageType: 'text', readBy: [{ user: sender._id, readAt: pastDate(0.5) }], isDeleted: false, createdAt: pastDate(1) },
    { _id: `m9_${conversationId}`, sender, content: { text: 'Can\'t wait! See you then 🙌' }, messageType: 'text', readBy: [], isDeleted: false, createdAt: pastDate(0.5) },
  ];

  return { messages, hasMore: false };
}

/* ═══════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════ */

function makeNotification(index: number): Notification {
  const sender = AUTHORS[index % AUTHORS.length];
  const types = ['like', 'comment', 'follow', 'follow_accept', 'mention', 'comment_reply'] as const;
  const type = types[index % types.length];

  const msgMap: Record<string, string> = {
    like: `${sender.fullName} liked your post`,
    comment: `${sender.fullName} commented: "This is amazing! 🔥"`,
    follow: `${sender.fullName} started following you`,
    follow_accept: `${sender.fullName} accepted your follow request`,
    mention: `${sender.fullName} mentioned you in a comment`,
    comment_reply: `${sender.fullName} replied to your comment: "Totally agree!"`,
  };

  return {
    _id: `notif_${index}`,
    sender: {
      _id: sender._id,
      username: sender.username,
      fullName: sender.fullName,
      profilePicture: sender.profilePicture,
      isVerified: sender.isVerified,
    },
    type,
    message: msgMap[type],
    contentType: type === 'like' || type === 'comment' ? 'post' : undefined,
    contentId: type === 'like' || type === 'comment' ? `post_${index}` : undefined,
    isRead: index > 4,
    createdAt: pastDate(index * 3 + 1),
  };
}

export const DUMMY_NOTIFICATIONS: Notification[] = Array.from({ length: 15 }, (_, i) => makeNotification(i));

export function getDummyNotifications(page: number, limit: number) {
  const start = (page - 1) * limit;
  const end = start + limit;
  const slice = DUMMY_NOTIFICATIONS.slice(start, end);
  return {
    notifications: slice,
    unreadCount: DUMMY_NOTIFICATIONS.filter((n) => !n.isRead).length,
    hasMore: end < DUMMY_NOTIFICATIONS.length,
  };
}

/* ═══════════════════════════════════════════════════════
   COMMENTS
   ═══════════════════════════════════════════════════════ */

const COMMENT_TEXTS = [
  'This is absolutely stunning! 😍',
  'Great work, keep it up!',
  'Love the composition here',
  'The colors are insane 🔥',
  'How do you get such sharp photos?!',
  'Need to visit this place ASAP',
  'Goals right here 💯',
  'This made my day, thank you!',
  'Wow, just wow ❤️',
  'Bookmarking this for inspiration',
  'Tutorial when? 😅',
  'The vibes are immaculate ✨',
];

function makeComment(index: number, contentType: string, contentId: string): Comment {
  const author = AUTHORS[(index + 2) % AUTHORS.length];
  return {
    _id: `comment_${contentId}_${index}`,
    author,
    content: COMMENT_TEXTS[index % COMMENT_TEXTS.length],
    contentType: contentType as 'post' | 'reel',
    contentId,
    parentComment: null,
    likesCount: index * 3 + 2,
    repliesCount: index % 3 === 0 ? 2 : 0,
    isEdited: false,
    isPinned: index === 0,
    createdAt: pastDate(index * 5 + 2),
  };
}

export function getDummyComments(contentType: string, contentId: string, page: number, limit: number) {
  const all = Array.from({ length: 12 }, (_, i) => makeComment(i, contentType, contentId));
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    comments: all.slice(start, end),
    hasMore: end < all.length,
  };
}

export function getDummyCommentReplies(commentId: string) {
  const parentAuthor = AUTHORS[3];
  return {
    replies: [
      {
        _id: `reply_${commentId}_1`,
        author: AUTHORS[1],
        content: 'Totally agree with this! 👏',
        contentType: 'post' as const,
        contentId: 'post_0',
        parentComment: commentId,
        likesCount: 5,
        repliesCount: 0,
        isEdited: false,
        isPinned: false,
        createdAt: pastDate(8),
      },
      {
        _id: `reply_${commentId}_2`,
        author: AUTHORS[5],
        content: 'Same here, absolute fire 🔥',
        contentType: 'post' as const,
        contentId: 'post_0',
        parentComment: commentId,
        likesCount: 2,
        repliesCount: 0,
        isEdited: false,
        isPinned: false,
        createdAt: pastDate(6),
      },
    ],
    hasMore: false,
  };
}

/* ═══════════════════════════════════════════════════════
   LIKES
   ═══════════════════════════════════════════════════════ */

export function getDummyLikes(contentType: string, contentId: string, page: number, limit: number) {
  const likes = DUMMY_SEARCH_USERS.slice(0, 10).map((u, i) => ({
    _id: `like_${contentId}_${i}`,
    user: u,
  }));
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    likes: likes.slice(start, end),
    hasMore: end < likes.length,
  };
}

/* ═══════════════════════════════════════════════════════
   FOLLOW REQUESTS
   ═══════════════════════════════════════════════════════ */

export const DUMMY_FOLLOW_REQUESTS: FollowRequest[] = AUTHORS.slice(6, 10).map((a, i) => ({
  _id: `freq_${i}`,
  user: {
    _id: a._id,
    username: a.username,
    fullName: a.fullName,
    profilePicture: a.profilePicture,
    isVerified: a.isVerified,
  },
  createdAt: pastDate(i * 12 + 6),
}));

/* ═══════════════════════════════════════════════════════
   SAVED POSTS
   ═══════════════════════════════════════════════════════ */

export function getDummySavedItems() {
  return {
    savedItems: DUMMY_POSTS.slice(0, 12).map((p, i) => ({
      _id: `saved_${i}`,
      post: {
        _id: p._id,
        media: p.media.map((m) => ({ url: m.url, thumbnail: m.thumbnail, type: m.type })),
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
      },
      createdAt: pastDate(i * 24),
    })),
  };
}

export function getDummyCollections() {
  return {
    collections: [
      { _id: 'col_1', name: 'Travel Inspo', coverImage: img(700, 400, 400), count: 24 },
      { _id: 'col_2', name: 'Food & Recipes', coverImage: img(701, 400, 400), count: 18 },
      { _id: 'col_3', name: 'Photography Tips', coverImage: img(702, 400, 400), count: 31 },
      { _id: 'col_4', name: 'Fitness', coverImage: img(703, 400, 400), count: 12 },
    ],
  };
}

/* ═══════════════════════════════════════════════════════
   ANALYTICS / INSIGHTS
   ═══════════════════════════════════════════════════════ */

export const DUMMY_ANALYTICS = {
  totalViews: 284500,
  totalLikes: 45200,
  totalComments: 3890,
  totalFollowers: DEMO_USER.followersCount,
  followersGrowth: 347,
  engagementRate: 0.068,
  topPosts: DUMMY_POSTS.slice(0, 5),
};

/* ═══════════════════════════════════════════════════════
   TRENDING HASHTAGS
   ═══════════════════════════════════════════════════════ */

export const DUMMY_TRENDING_HASHTAGS = [
  { _id: 'h1', name: 'photography', postsCount: 1240000 },
  { _id: 'h2', name: 'travel', postsCount: 980000 },
  { _id: 'h3', name: 'art', postsCount: 750000 },
  { _id: 'h4', name: 'fitness', postsCount: 620000 },
  { _id: 'h5', name: 'food', postsCount: 540000 },
  { _id: 'h6', name: 'nature', postsCount: 480000 },
  { _id: 'h7', name: 'fashion', postsCount: 410000 },
  { _id: 'h8', name: 'music', postsCount: 380000 },
  { _id: 'h9', name: 'design', postsCount: 320000 },
  { _id: 'h10', name: 'coding', postsCount: 280000 },
];

/* ═══════════════════════════════════════════════════════
   MUTUAL FOLLOWERS
   ═══════════════════════════════════════════════════════ */

export function getDummyMutualFollowers(userId: string) {
  return {
    mutualFollowers: DUMMY_SEARCH_USERS.slice(0, 3),
    count: 3,
  };
}

/* ═══════════════════════════════════════════════════════
   COLLABORATIONS
   ═══════════════════════════════════════════════════════ */

export const DUMMY_COLLABORATIONS = [
  {
    _id: 'collab_1',
    brand: { _id: 'brand_1', name: 'Adobe Creative', logo: img(900, 80, 80), isVerified: true },
    title: 'Spring Photography Campaign',
    description: 'Create 3 posts showcasing Adobe Lightroom presets for spring landscapes.',
    status: 'active' as const,
    budget: 2500,
    currency: 'USD',
    deliverables: ['3 Feed Posts', '5 Story Frames', '1 Reel'],
    deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
    completedDeliverables: 1,
    totalDeliverables: 3,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    _id: 'collab_2',
    brand: { _id: 'brand_2', name: 'Sony Alpha', logo: img(901, 80, 80), isVerified: true },
    title: 'Camera Review Series',
    description: 'Unboxing and review of the new Sony A7V camera body.',
    status: 'pending' as const,
    budget: 4000,
    currency: 'USD',
    deliverables: ['1 YouTube Video', '2 Reels', '3 Stories'],
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    startDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    completedDeliverables: 0,
    totalDeliverables: 3,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    _id: 'collab_3',
    brand: { _id: 'brand_3', name: 'Peak Design', logo: img(902, 80, 80), isVerified: false },
    title: 'Travel Bag Showcase',
    description: 'Feature the Peak Design Travel Backpack on a weekend trip.',
    status: 'completed' as const,
    budget: 1800,
    currency: 'USD',
    deliverables: ['2 Feed Posts', '4 Stories'],
    deadline: new Date(Date.now() - 5 * 86400000).toISOString(),
    startDate: new Date(Date.now() - 20 * 86400000).toISOString(),
    completedDeliverables: 2,
    totalDeliverables: 2,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    _id: 'collab_4',
    brand: { _id: 'brand_4', name: 'Nike Running', logo: img(903, 80, 80), isVerified: true },
    title: 'Marathon Training Journey',
    description: 'Document your marathon training wearing Nike gear over 4 weeks.',
    status: 'declined' as const,
    budget: 5000,
    currency: 'USD',
    deliverables: ['8 Feed Posts', '16 Stories', '2 Reels'],
    deadline: new Date(Date.now() + 45 * 86400000).toISOString(),
    startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    completedDeliverables: 0,
    totalDeliverables: 3,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

/* ═══════════════════════════════════════════════════════
   REVENUE
   ═══════════════════════════════════════════════════════ */

export const DUMMY_REVENUE = {
  totalEarnings: 12450,
  thisMonth: 3200,
  lastMonth: 2800,
  pending: 1200,
  currency: 'USD',
  monthlyData: [
    { month: 'Nov', amount: 1800 },
    { month: 'Dec', amount: 2200 },
    { month: 'Jan', amount: 2450 },
    { month: 'Feb', amount: 2800 },
    { month: 'Mar', amount: 3200 },
  ],
  breakdown: [
    { source: 'Brand Collaborations', amount: 8300, percentage: 66.7 },
    { source: 'Ad Revenue', amount: 2150, percentage: 17.3 },
    { source: 'Memberships', amount: 1200, percentage: 9.6 },
    { source: 'Tips & Gifts', amount: 800, percentage: 6.4 },
  ],
  recentTransactions: [
    { _id: 'tx_1', description: 'Adobe Creative — Campaign Payment', amount: 2500, date: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'completed' as const },
    { _id: 'tx_2', description: 'Peak Design — Showcase Payment', amount: 1800, date: new Date(Date.now() - 8 * 86400000).toISOString(), status: 'completed' as const },
    { _id: 'tx_3', description: 'Ad Revenue — March 2026', amount: 680, date: new Date(Date.now() - 14 * 86400000).toISOString(), status: 'completed' as const },
    { _id: 'tx_4', description: 'Sony Alpha — Review Payment', amount: 4000, date: new Date(Date.now() - 1 * 86400000).toISOString(), status: 'pending' as const },
    { _id: 'tx_5', description: 'Membership Revenue — March', amount: 420, date: new Date(Date.now() - 5 * 86400000).toISOString(), status: 'completed' as const },
  ],
};

/* ═══════════════════════════════════════════════════════
   ADS / PROMOTIONS
   ═══════════════════════════════════════════════════════ */

export const DUMMY_ADS = [
  {
    _id: 'ad_1',
    postId: DUMMY_POSTS[0]._id,
    postImage: DUMMY_POSTS[0].media[0].url,
    caption: DUMMY_POSTS[0].caption.slice(0, 60) + '...',
    status: 'active' as const,
    budget: 50,
    spent: 32.40,
    currency: 'USD',
    duration: 7,
    daysRemaining: 3,
    reach: 14500,
    impressions: 21800,
    clicks: 342,
    engagement: 0.047,
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 3 * 86400000).toISOString(),
  },
  {
    _id: 'ad_2',
    postId: DUMMY_POSTS[2]._id,
    postImage: DUMMY_POSTS[2].media[0].url,
    caption: DUMMY_POSTS[2].caption.slice(0, 60) + '...',
    status: 'completed' as const,
    budget: 30,
    spent: 30,
    currency: 'USD',
    duration: 5,
    daysRemaining: 0,
    reach: 9200,
    impressions: 13400,
    clicks: 198,
    engagement: 0.038,
    startDate: new Date(Date.now() - 12 * 86400000).toISOString(),
    endDate: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    _id: 'ad_3',
    postId: DUMMY_POSTS[4]._id,
    postImage: DUMMY_POSTS[4].media[0].url,
    caption: DUMMY_POSTS[4].caption.slice(0, 60) + '...',
    status: 'paused' as const,
    budget: 75,
    spent: 18.60,
    currency: 'USD',
    duration: 14,
    daysRemaining: 10,
    reach: 5600,
    impressions: 7800,
    clicks: 89,
    engagement: 0.029,
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 10 * 86400000).toISOString(),
  },
];
