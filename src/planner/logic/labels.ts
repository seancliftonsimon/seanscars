import type {
  AwardStage,
  FilmReaction,
  IdeaTag,
  InvitationStatus,
  InviteMethod,
  PieceKind,
  PlaybackSource,
  QuestionStatus,
  SegmentType,
  StepStatus,
  VenueStatus,
} from '../types';

/*
 * Human labels for stored tokens. The stored values never change; only
 * what the screen says does.
 */

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  'invite?': 'On the list',
  invited: 'Invited',
  confirmed: 'Coming',
  maybe: 'Maybe',
  declined: "Can't come",
  'not-inviting': 'Not this year',
};

/** Order the guest list sorts and offers statuses in. */
export const INVITATION_STATUS_ORDER: InvitationStatus[] = [
  'confirmed',
  'maybe',
  'invited',
  'invite?',
  'declined',
  'not-inviting',
];

export const INVITE_METHOD_LABEL: Record<InviteMethod, string> = {
  text: 'Text',
  email: 'Email',
  mail: 'Mail',
  hand: 'In person',
};
export const INVITE_METHODS: InviteMethod[] = ['text', 'email', 'mail', 'hand'];

export const PIECE_KIND_LABEL: Record<PieceKind, string> = {
  'award-video': 'Award video',
  song: 'Song',
  'slides-bit': 'Slide bit',
  'contributor-deck': 'Guest presentation',
  other: 'Other',
};
export const PIECE_KINDS: PieceKind[] = ['award-video', 'song', 'slides-bit', 'contributor-deck', 'other'];

export const AWARD_STAGE_LABEL: Record<AwardStage, string> = {
  idea: 'Idea',
  contenders: 'Gathering contenders',
  nominees: 'Nominees set',
  winner: 'Winner picked',
  cut: 'Cut',
};

export const VENUE_STATUS_LABEL: Record<VenueStatus, string> = {
  researching: 'Researching',
  inquired: 'Asked',
  holding: 'On hold',
  booked: 'Booked',
  declined: 'Ruled out',
};
export const VENUE_STATUSES: VenueStatus[] = ['researching', 'inquired', 'holding', 'booked', 'declined'];

export const SEGMENT_TYPE_LABEL: Record<SegmentType, string> = {
  live: 'Live',
  pretape: 'Pre-taped',
  song: 'Song',
  intermission: 'Intermission',
};

export const PLAYBACK_LABEL: Record<PlaybackSource, string> = {
  slides: 'Slides',
  video: 'Video',
  browser: 'Browser',
  'live-music': 'Live music',
  none: 'Nothing',
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
};

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  open: 'Open',
  decided: 'Decided',
};

export const REACTION_LABEL: Record<FilmReaction, string> = {
  loved: 'Loved',
  liked: 'Liked',
  meh: 'Meh',
  disliked: 'Disliked',
};
export const REACTIONS: FilmReaction[] = ['loved', 'liked', 'meh', 'disliked'];

export const IDEA_TAG_LABEL: Record<IdeaTag, string> = {
  song: 'Song',
  award: 'Award',
  bit: 'Bit',
  theme: 'Theme',
  other: 'Other',
};
export const IDEA_TAGS: IdeaTag[] = ['song', 'award', 'bit', 'theme', 'other'];

/** "Sean", or the owners' names joined with "&". */
export function ownerNames(ids: string[], peopleById: ReadonlyMap<string, { name: string }>, none = 'Sean'): string {
  if (ids.length === 0) return none;
  return ids.map((id) => peopleById.get(id)?.name ?? 'Unknown').join(' & ');
}
