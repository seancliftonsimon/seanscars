import type { Venue } from '../types';
import type { HeadcountProjection } from './headcount';

export type VenueFit = 'fits' | 'tight' | 'small' | 'unknown';

/**
 * How a venue's capacity compares with the projected headcount: fits even
 * if everyone listed comes; fits the likely crowd; or too small.
 */
export function venueFit(venue: Pick<Venue, 'capacity'>, p: HeadcountProjection): VenueFit {
  if (!venue.capacity) return 'unknown';
  if (venue.capacity >= p.everyone.total) return 'fits';
  if (venue.capacity >= Math.max(p.likely.total, p.confirmed.total)) return 'tight';
  return 'small';
}

export const VENUE_FIT_LABEL: Record<VenueFit, string> = {
  fits: 'Fits everyone listed',
  tight: 'Fits the likely crowd',
  small: 'Too small',
  unknown: 'Capacity unknown',
};
