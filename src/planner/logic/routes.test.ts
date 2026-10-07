import { describe, expect, it } from 'vitest';
import { isPlannerPath, legacySearch, plannerPageTitle } from '../routes';

describe('planner routes', () => {
  it('recognises planner paths only', () => {
    expect(isPlannerPath('/plan')).toBe(true);
    expect(isPlannerPath('/plan/show')).toBe(true);
    expect(isPlannerPath('/planner')).toBe(false);
    expect(isPlannerPath('/')).toBe(false);
  });

  it('builds page titles, old paths included', () => {
    expect(plannerPageTitle('/plan')).toBe('Planner | Home');
    expect(plannerPageTitle('/plan/')).toBe('Planner | Home');
    expect(plannerPageTitle('/plan/show')).toBe('Planner | Show');
    expect(plannerPageTitle('/plan/show/print')).toBe('Planner | Print run of show');
    expect(plannerPageTitle('/plan/films')).toBe('Planner | Ideas');
    expect(plannerPageTitle('/plan/people')).toBe('Planner | Guests');
    expect(plannerPageTitle('/plan/nope')).toBe('Planner | Home');
    expect(plannerPageTitle('/plan/make/song/abc123')).toBe('Planner | Song');
    expect(plannerPageTitle('/plan/make/song/abc123/sheet')).toBe('Planner | Song');
  });

  it('translates old deep links', () => {
    expect(legacySearch('people', '?tab=inbox')).toBe('?view=replies');
    expect(legacySearch('people', '?person=p1')).toBe('?person=p1');
    expect(legacySearch('awards', '?tab=pieces&piece=x')).toBe('?view=pieces&piece=x');
    expect(legacySearch('awards', '?award=a1')).toBe('?view=awards&award=a1');
    expect(legacySearch('films', '')).toBe('?view=films');
    expect(legacySearch('logistics', '')).toBe('');
  });
});
