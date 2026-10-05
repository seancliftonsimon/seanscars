import { describe, expect, it } from 'vitest';
import { navAttention } from './attention';
import { defaultSteps } from './steps';

describe('navAttention', () => {
  it('counts what is overdue and new', () => {
    const a = navAttention(
      {
        inboxCount: 3,
        pieces: [
          { id: 'a', title: 'a', kind: 'other', ownerPersonIds: [], order: 0, links: [], steps: defaultSteps('other'), dueDate: '2027-01-01' },
          { id: 'b', title: 'b', kind: 'other', ownerPersonIds: [], order: 0, links: [], steps: defaultSteps('other', 'done'), dueDate: '2027-01-01' },
        ],
        questions: [
          { id: 'q', question: 'q', status: 'open', dueDate: '2027-01-02' },
          { id: 'r', question: 'r', status: 'decided', dueDate: '2027-01-02' },
        ],
        checklist: [{ id: 't', text: 't', done: false, order: 0, dueDate: '2027-01-03' }],
        clockState: 'over',
      },
      '2027-01-05',
    );
    expect(a).toEqual({ guests: 3, make: 1, prep: 2, showOver: true });
  });
});
