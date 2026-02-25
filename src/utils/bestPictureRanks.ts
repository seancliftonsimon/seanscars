const DEFAULT_BEST_PICTURE_RANK_COUNT = 5;

interface RankedMovie {
  id: string;
  seen: boolean;
  rank?: number | null;
}

interface BallotWithBestPictureRanks {
  bestPictureRanks?: unknown;
  movies?: RankedMovie[];
}

export function getCanonicalBestPictureRanks(
  ballot: BallotWithBestPictureRanks,
  requiredCount = DEFAULT_BEST_PICTURE_RANK_COUNT
): string[] {
  const seenMovieIds = new Set(
    Array.isArray(ballot.movies)
      ? ballot.movies.filter((movie) => movie.seen).map((movie) => movie.id)
      : []
  );

  const bestPictureRanks = ballot.bestPictureRanks;
  if (
    Array.isArray(bestPictureRanks) &&
    bestPictureRanks.length === requiredCount &&
    bestPictureRanks.every((movieId) => typeof movieId === 'string') &&
    new Set(bestPictureRanks).size === requiredCount &&
    bestPictureRanks.every((movieId) => seenMovieIds.has(movieId))
  ) {
    return bestPictureRanks;
  }

  if (!Array.isArray(ballot.movies)) {
    return [];
  }

  const legacyRankedMovies = ballot.movies
    .filter((movie) =>
      movie.seen &&
      typeof movie.rank === 'number' &&
      Number.isInteger(movie.rank) &&
      movie.rank >= 1 &&
      movie.rank <= requiredCount
    )
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const usedRanks = new Set<number>();
  const orderedIds: string[] = [];

  legacyRankedMovies.forEach((movie) => {
    const rank = movie.rank as number;
    if (usedRanks.has(rank) || orderedIds.includes(movie.id)) {
      return;
    }

    usedRanks.add(rank);
    orderedIds.push(movie.id);
  });

  return orderedIds;
}
