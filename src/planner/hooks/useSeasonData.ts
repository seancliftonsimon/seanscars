import { useMemo } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { peopleCol, seasonCol } from '../firestore';
import { useCollection } from './useCollection';
import type {
  Award,
  ChecklistItem,
  Film,
  Idea,
  Person,
  Piece,
  Question,
  Segment,
  Venue,
  WithId,
} from '../types';

export interface SeasonData {
  /** Sorted by `order` (then id). */
  awards: WithId<Award>[];
  /** Sorted by `order` (then id). */
  pieces: WithId<Piece>[];
  /** Running order. */
  segments: WithId<Segment>[];
  venues: WithId<Venue>[];
  questions: WithId<Question>[];
  checklist: WithId<ChecklistItem>[];
  /** Sorted by title. */
  films: WithId<Film>[];
  ideas: WithId<Idea>[];
  /** All people (not per season), sorted by name. */
  people: WithId<Person>[];
  peopleById: Map<string, WithId<Person>>;
  loading: boolean;
  error: FirestoreError | null;
}

const byOrder = <T extends { order: number; id: string }>(a: T, b: T) => a.order - b.order || a.id.localeCompare(b.id);

/** Live subscriptions to everything a planner screen may need for one season. */
export function useSeasonData(seasonId: string | null): SeasonData {
  const awards = useCollection(seasonId ? seasonCol(seasonId, 'awards') : null);
  const pieces = useCollection(seasonId ? seasonCol(seasonId, 'pieces') : null);
  const segments = useCollection(seasonId ? seasonCol(seasonId, 'segments') : null);
  const venues = useCollection(seasonId ? seasonCol(seasonId, 'venues') : null);
  const questions = useCollection(seasonId ? seasonCol(seasonId, 'questions') : null);
  const checklist = useCollection(seasonId ? seasonCol(seasonId, 'checklist') : null);
  const films = useCollection(seasonId ? seasonCol(seasonId, 'films') : null);
  const ideas = useCollection(seasonId ? seasonCol(seasonId, 'ideas') : null);
  const people = useCollection(peopleCol());

  const states = [awards, pieces, segments, venues, questions, checklist, films, ideas, people];
  const loading = states.some((s) => s.loading);
  const error = states.find((s) => s.error)?.error ?? null;

  return useMemo(() => {
    const sortedPeople = [...people.data].sort((a, b) => a.name.localeCompare(b.name));
    return {
      awards: [...awards.data].sort(byOrder),
      pieces: [...pieces.data].sort(byOrder),
      segments: [...segments.data].sort(byOrder),
      venues: venues.data,
      questions: questions.data,
      checklist: checklist.data,
      films: [...films.data].sort((a, b) => a.title.localeCompare(b.title)),
      ideas: ideas.data,
      people: sortedPeople,
      peopleById: new Map(sortedPeople.map((p) => [p.id, p])),
      loading,
      error,
    };
  }, [
    awards.data,
    pieces.data,
    segments.data,
    venues.data,
    questions.data,
    checklist.data,
    films.data,
    ideas.data,
    people.data,
    loading,
    error,
  ]);
}
