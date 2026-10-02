import {
  Ban,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  HelpCircle,
  Lightbulb,
  ListPlus,
  Loader,
  MinusCircle,
  Pause,
  Search,
  Send,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import type { ChipOption, Tone } from './ui/Chip';
import {
  AWARD_STAGE_LABEL,
  INVITATION_STATUS_LABEL,
  INVITATION_STATUS_ORDER,
  VENUE_STATUS_LABEL,
  VENUE_STATUSES,
} from '../logic/labels';
import type { AwardStage, InvitationStatus, VenueStatus } from '../types';

/* Status → chip (tone + icon). Color is never the only cue: each has an icon and a word. */

const INV: Record<InvitationStatus, Omit<ChipOption<InvitationStatus>, 'value' | 'label'>> = {
  confirmed: { tone: 'good', icon: CheckCircle2 },
  maybe: { tone: 'warn', icon: HelpCircle },
  invited: { tone: 'info', icon: Send },
  'invite?': { tone: 'accent', icon: ListPlus },
  declined: { tone: 'faint', icon: XCircle },
  'not-inviting': { tone: 'faint', icon: MinusCircle },
};

export const INVITATION_OPTIONS: ChipOption<InvitationStatus>[] = INVITATION_STATUS_ORDER.map((s) => ({
  value: s,
  label: INVITATION_STATUS_LABEL[s],
  ...INV[s],
}));

export const invitationChip = (s: InvitationStatus) => INVITATION_OPTIONS.find((o) => o.value === s)!;

const VEN: Record<VenueStatus, { tone: Tone; icon: typeof Circle }> = {
  researching: { tone: 'faint', icon: Search },
  inquired: { tone: 'info', icon: Send },
  holding: { tone: 'warn', icon: Pause },
  booked: { tone: 'good', icon: CheckCircle2 },
  declined: { tone: 'faint', icon: Ban },
};
export const VENUE_OPTIONS: ChipOption<VenueStatus>[] = VENUE_STATUSES.map((s) => ({ value: s, label: VENUE_STATUS_LABEL[s], ...VEN[s] }));
export const venueChip = (s: VenueStatus) => VENUE_OPTIONS.find((o) => o.value === s)!;

const AWD: Record<AwardStage, { tone: Tone; icon: typeof Circle }> = {
  idea: { tone: 'faint', icon: Lightbulb },
  contenders: { tone: 'info', icon: Users },
  nominees: { tone: 'warn', icon: CircleDot },
  winner: { tone: 'good', icon: Trophy },
  cut: { tone: 'faint', icon: Ban },
};
export const awardChip = (s: AwardStage): ChipOption<AwardStage> => ({ value: s, label: AWARD_STAGE_LABEL[s], ...AWD[s] });

export const STEP_ICON = { todo: CircleDashed, doing: Loader, done: CheckCircle2 };
