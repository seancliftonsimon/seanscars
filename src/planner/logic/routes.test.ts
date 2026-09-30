import { describe, expect, it } from 'vitest';
import { isPlannerPath, plannerPageTitle } from '../routes';

describe('planner routes', () => {
  it('recognises planner paths only', () => {
    expect(isPlannerPath('/plan')).toBe(true);
    expect(isPlannerPath('/plan/show')).toBe(true);
    expect(isPlannerPath('/planner')).toBe(false);
    expect(isPlannerPath('/')).toBe(false);
  });

  it('builds page titles', () => {
    expect(plannerPageTitle('/plan')).toBe('Planner | Now');
    expect(plannerPageTitle('/plan/')).toBe('Planner | Now');
    expect(plannerPageTitle('/plan/show')).toBe('Planner | Show');
    expect(plannerPageTitle('/plan/show/print')).toBe('Planner | Print run of show');
    expect(plannerPageTitle('/plan/awards')).toBe('Planner | Awards & pieces');
    expect(plannerPageTitle('/plan/templates')).toBe('Planner | Task templates');
    expect(plannerPageTitle('/plan/films')).toBe('Planner | Films & ideas');
    expect(plannerPageTitle('/plan/nope')).toBe('Planner | Now');
  });
});
