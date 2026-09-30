import { describe, expect, it } from 'vitest';
import { defaultSteps, reusableSteps, uniqueStepKey } from './steps';
import { planRollover } from './rollover';
import { defaultSeason } from './season';
import { contributorPieceFromRsvp } from './rsvp';
import type { PieceTemplates } from '../types';

describe('reusable production templates', () => {
  const templates: PieceTemplates = {
    song: [{ key: 'lyrics', label: 'Draft lyrics' }, { key: 'rehearsal', label: 'Record a rehearsal' }],
    'contributor-deck': [{ key: 'asked', label: 'Invite presenter' }, { key: 'submitted', label: 'Receive slides' }],
  };
  it('uses customized tasks for new pieces without mutating the template or other pieces', () => {
    const first = defaultSteps('song', 'todo', templates);
    first[0].status = 'done';
    first[1].label = 'Changed just for this piece';
    expect(defaultSteps('song', 'todo', templates)).toEqual([
      { key: 'lyrics', label: 'Draft lyrics', status: 'todo' },
      { key: 'rehearsal', label: 'Record a rehearsal', status: 'todo' },
    ]);
    expect(defaultSteps('award-video', 'todo', templates)).toEqual(defaultSteps('award-video'));
  });
  it('copies labels and semantic keys without copying progress', () => {
    expect(reusableSteps([{ key: 'winner-decided', label: ' Pick winner ', status: 'done' }])).toEqual([{ key: 'winner-decided', label: 'Pick winner' }]);
  });
  it('creates distinct keys for duplicate task names', () => {
    expect(uniqueStepKey('Lyrics', [{ key: 'lyrics' }, { key: 'lyrics-2' }])).toBe('lyrics-3');
  });
  it('carries defaults into the next season and contributor drafts', () => {
    const season = { ...defaultSeason(2026), pieceTemplates: templates };
    const plan = planRollover({ season, awards: [], invitations: [], segments: [{ id: 'slot', order: 1000, title: 'Demo presentation', type: 'live', playbackSource: 'slides', plannedSec: 120, ownerPersonIds: ['invented-presenter'] }] }, 2027);
    expect(plan.season.pieceTemplates).toEqual(templates);
    expect(plan.pieces[0].piece.steps).toEqual(defaultSteps('contributor-deck', 'todo', templates));
    plan.season.pieceTemplates!.song![0].label = 'New season only';
    expect(templates.song![0].label).toBe('Draft lyrics');
  });
  it('applies contributor defaults to RSVP pieces while retaining the asked milestone', () => {
    const piece = contributorPieceFromRsvp({ awardName: 'Demo award' }, 'invented-presenter', 1000, '2026-09-29', templates);
    expect(piece.steps).toEqual([
      { key: 'asked', label: 'Invite presenter', status: 'done' },
      { key: 'submitted', label: 'Receive slides', status: 'todo' },
    ]);
  });
});
