import moviesData from '../data/movies.json';
import { getCanonicalBestPictureRanks } from './bestPictureRanks';

const EXHAUSTED_TARGET_ID = '__EXHAUSTED__';
const FALLBACK_VOTER_NAME = 'Anonymous';
const BALLOT_EMOJI = '🏆';

interface RcvMovie {
  id: string;
  seen: boolean;
  title?: string;
}

export interface RcvBallot {
  id: string;
  voterName?: string;
  timestamp?: string;
  movies: RcvMovie[];
  bestPictureRanks?: string[];
}

export interface ParticipationLeader {
  voterName: string;
  count: number;
}

export interface ParticipationStats {
  includedBallots: number;
  totalBallots: number;
  excludedBallots: number;
  uniqueMoviesVotedOn: number;
  mostMoviesSeen: ParticipationLeader | null;
}

export interface CandidateTally {
  candidateId: string;
  title: string;
  votes: number;
}

export interface TransferSummary {
  fromCandidateId: string;
  fromTitle: string;
  toCandidateId: string | null;
  toTitle: string;
  count: number;
}

export interface VoteTokenSnapshot {
  tokenId: string;
  ballotId: string;
  rankIndex: number;
  emoji: string;
}

export interface CandidateStepState {
  candidateId: string;
  title: string;
  votes: number;
  status: 'active' | 'eliminated' | 'winner';
  tokens: VoteTokenSnapshot[];
}

export interface VoteMovement {
  tokenId: string;
  ballotId: string;
  fromCandidateId: string;
  fromEmoji: string;
  toCandidateId: string | null;
  emoji: string;
}

export type RcvStepType =
  | 'standings'
  | 'tally'
  | 'elimination'
  | 'redistribution'
  | 'threshold-update'
  | 'winner';

export interface RcvPresentationStep {
  id: string;
  roundNumber: number;
  type: RcvStepType;
  title: string;
  explanation: string;
  activeBallots: number;
  threshold: number;
  exhaustedBallots: number;
  newlyEliminated: string[];
  candidates: CandidateStepState[];
  voteMovements: VoteMovement[];
}

export interface RcvRoundData {
  roundNumber: number;
  tallies: CandidateTally[];
  eliminated: string[];
  transfers: TransferSummary[];
  activeBallots: number;
  threshold: number;
  winner: string | null;
}

export interface RcvComputationResult {
  rounds: RcvRoundData[];
  winner: string | null;
  steps: RcvPresentationStep[];
  candidateOrder: string[];
  titlesByCandidateId: Record<string, string>;
}

interface RankedBallotContext {
  ballotId: string;
  ranks: string[];
}

interface BallotAssignment {
  candidateId: string | null;
  rankIndex: number | null;
}

const buildMovieTitleMap = (ballots: RcvBallot[]) => {
  const titlesByMovieId: Record<string, string> = {};

  moviesData.forEach((movie) => {
    titlesByMovieId[movie.id] = movie.title;
  });

  ballots.forEach((ballot) => {
    ballot.movies.forEach((movie) => {
      if (movie.id && !titlesByMovieId[movie.id]) {
        titlesByMovieId[movie.id] = movie.title || movie.id;
      }
    });
  });

  return titlesByMovieId;
};

const compareCandidateIds = (
  leftId: string,
  rightId: string,
  titlesByMovieId: Record<string, string>
) => {
  const leftTitle = titlesByMovieId[leftId] || leftId;
  const rightTitle = titlesByMovieId[rightId] || rightId;

  const titleComparison = leftTitle.localeCompare(rightTitle);
  if (titleComparison !== 0) {
    return titleComparison;
  }

  return leftId.localeCompare(rightId);
};

const getTopSeenBallot = (ballots: RcvBallot[]): ParticipationLeader | null => {
  const rankedSeenCounts = ballots.map((ballot) => {
    const voterName = ballot.voterName?.trim() || FALLBACK_VOTER_NAME;
    const seenCount = ballot.movies.filter((movie) => movie.seen).length;
    const parsedTimestamp = ballot.timestamp ? Date.parse(ballot.timestamp) : NaN;
    const timestampSortValue = Number.isFinite(parsedTimestamp)
      ? parsedTimestamp
      : Number.POSITIVE_INFINITY;

    return {
      ballotId: ballot.id,
      voterName,
      seenCount,
      timestampSortValue,
    };
  });

  rankedSeenCounts.sort((left, right) => {
    if (right.seenCount !== left.seenCount) {
      return right.seenCount - left.seenCount;
    }

    if (left.timestampSortValue !== right.timestampSortValue) {
      return left.timestampSortValue - right.timestampSortValue;
    }

    const nameComparison = left.voterName.localeCompare(right.voterName);
    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.ballotId.localeCompare(right.ballotId);
  });

  const topSeen = rankedSeenCounts[0];
  if (!topSeen) {
    return null;
  }

  return {
    voterName: topSeen.voterName,
    count: topSeen.seenCount,
  };
};

const getRankEmoji = (_rankIndex: number | null) => {
  void _rankIndex;
  return BALLOT_EMOJI;
};

const getFirstRemainingChoice = (
  ranks: string[],
  remainingSet: Set<string>
): BallotAssignment => {
  for (let index = 0; index < ranks.length; index += 1) {
    const candidateId = ranks[index];
    if (remainingSet.has(candidateId)) {
      return {
        candidateId,
        rankIndex: index,
      };
    }
  }

  return {
    candidateId: null,
    rankIndex: null,
  };
};

const calculateAssignments = (
  ballots: RankedBallotContext[],
  remainingSet: Set<string>
) => {
  const assignments = new Map<string, BallotAssignment>();

  ballots.forEach((ballot) => {
    assignments.set(ballot.ballotId, getFirstRemainingChoice(ballot.ranks, remainingSet));
  });

  return assignments;
};

const countActiveAssignments = (assignments: Map<string, BallotAssignment>) =>
  Array.from(assignments.values()).filter(
    (assignment) => assignment.candidateId !== null
  ).length;

const getMajorityThreshold = (activeBallots: number) =>
  activeBallots > 0 ? Math.floor(activeBallots / 2) + 1 : 0;

const buildCandidateStepState = (
  candidateOrder: string[],
  assignments: Map<string, BallotAssignment>,
  titlesByMovieId: Record<string, string>,
  eliminatedCandidateIds: Set<string>,
  winnerId: string | null
): CandidateStepState[] => {
  const tokensByCandidateId = new Map<string, VoteTokenSnapshot[]>();

  assignments.forEach((assignment, ballotId) => {
    if (!assignment.candidateId || assignment.rankIndex === null) {
      return;
    }

    const candidateTokens = tokensByCandidateId.get(assignment.candidateId) || [];
    candidateTokens.push({
      tokenId: ballotId,
      ballotId,
      rankIndex: assignment.rankIndex,
      emoji: getRankEmoji(assignment.rankIndex),
    });
    tokensByCandidateId.set(assignment.candidateId, candidateTokens);
  });

  candidateOrder.forEach((candidateId) => {
    const tokens = tokensByCandidateId.get(candidateId);
    if (!tokens) {
      return;
    }

    tokens.sort((left, right) => {
      if (left.rankIndex !== right.rankIndex) {
        return left.rankIndex - right.rankIndex;
      }

      return left.ballotId.localeCompare(right.ballotId);
    });
  });

  return candidateOrder.map((candidateId) => {
    const votes = tokensByCandidateId.get(candidateId)?.length || 0;
    let status: CandidateStepState['status'] = 'active';
    if (winnerId === candidateId) {
      status = 'winner';
    } else if (eliminatedCandidateIds.has(candidateId)) {
      status = 'eliminated';
    }

    return {
      candidateId,
      title: titlesByMovieId[candidateId] || candidateId,
      votes,
      status,
      tokens: tokensByCandidateId.get(candidateId) || [],
    };
  });
};

const buildTransferSummaries = (
  movements: VoteMovement[],
  titlesByMovieId: Record<string, string>
): TransferSummary[] => {
  const countsByPath = new Map<string, number>();

  movements.forEach((movement) => {
    const transferKey = JSON.stringify([
      movement.fromCandidateId,
      movement.toCandidateId ?? EXHAUSTED_TARGET_ID,
    ]);
    countsByPath.set(transferKey, (countsByPath.get(transferKey) || 0) + 1);
  });

  return Array.from(countsByPath.entries())
    .map(([transferKey, count]) => {
      const [fromCandidateId, toCandidateToken] = JSON.parse(transferKey) as [
        string,
        string,
      ];
      const isExhausted = toCandidateToken === EXHAUSTED_TARGET_ID;
      const toCandidateId = isExhausted ? null : toCandidateToken;

      return {
        fromCandidateId,
        fromTitle: titlesByMovieId[fromCandidateId] || fromCandidateId,
        toCandidateId,
        toTitle: toCandidateId
          ? titlesByMovieId[toCandidateId] || toCandidateId
          : 'Exhausted',
        count,
      };
    })
    .sort((left, right) => {
      const fromComparison = compareCandidateIds(
        left.fromCandidateId,
        right.fromCandidateId,
        titlesByMovieId
      );
      if (fromComparison !== 0) {
        return fromComparison;
      }

      if (!left.toCandidateId && right.toCandidateId) {
        return 1;
      }
      if (left.toCandidateId && !right.toCandidateId) {
        return -1;
      }

      if (left.toCandidateId && right.toCandidateId) {
        return compareCandidateIds(
          left.toCandidateId,
          right.toCandidateId,
          titlesByMovieId
        );
      }

      return 0;
    });
};

export function calculateParticipationStats(
  includedBallots: RcvBallot[],
  totalBallotCount = includedBallots.length
): ParticipationStats {
  const uniqueSeenMovieIds = new Set<string>();
  includedBallots.forEach((ballot) => {
    ballot.movies.forEach((movie) => {
      if (movie.seen) {
        uniqueSeenMovieIds.add(movie.id);
      }
    });
  });

  return {
    includedBallots: includedBallots.length,
    totalBallots: totalBallotCount,
    excludedBallots: Math.max(totalBallotCount - includedBallots.length, 0),
    uniqueMoviesVotedOn: uniqueSeenMovieIds.size,
    mostMoviesSeen: getTopSeenBallot(includedBallots),
  };
}

export function calculateRankedChoiceRounds(
  includedBallots: RcvBallot[]
): RcvComputationResult {
  const titlesByMovieId = buildMovieTitleMap(includedBallots);

  const rankedBallots: RankedBallotContext[] = includedBallots.map((ballot) => ({
    ballotId: ballot.id,
    ranks: getCanonicalBestPictureRanks(ballot),
  }));

  const initialCandidates = new Set<string>();
  rankedBallots.forEach((ballot) => {
    ballot.ranks.forEach((movieId) => {
      initialCandidates.add(movieId);
    });
  });

  const candidateOrder = Array.from(initialCandidates).sort((leftId, rightId) =>
    compareCandidateIds(leftId, rightId, titlesByMovieId)
  );
  const titlesByCandidateId: Record<string, string> = {};
  candidateOrder.forEach((candidateId) => {
    titlesByCandidateId[candidateId] = titlesByMovieId[candidateId] || candidateId;
  });

  let remainingCandidates = new Set(candidateOrder);
  const rounds: RcvRoundData[] = [];
  const steps: RcvPresentationStep[] = [];
  let overallWinner: string | null = null;
  let roundNumber = 1;
  const eliminatedCandidateIds = new Set<string>();
  let loopGuard = 0;

  while (remainingCandidates.size > 0 && loopGuard < 500) {
    loopGuard += 1;

    const remainingIds = Array.from(remainingCandidates).sort((leftId, rightId) =>
      compareCandidateIds(leftId, rightId, titlesByMovieId)
    );
    const remainingSet = new Set(remainingIds);

    const assignments = calculateAssignments(rankedBallots, remainingSet);
    const talliesByCandidate = new Map<string, number>();
    remainingIds.forEach((candidateId) => {
      talliesByCandidate.set(candidateId, 0);
    });

    assignments.forEach((assignment) => {
      if (assignment.candidateId) {
        talliesByCandidate.set(
          assignment.candidateId,
          (talliesByCandidate.get(assignment.candidateId) || 0) + 1
        );
      }
    });

    const activeBallots = countActiveAssignments(assignments);
    const threshold = getMajorityThreshold(activeBallots);

    const tallies: CandidateTally[] = remainingIds
      .map((candidateId) => ({
        candidateId,
        title: titlesByMovieId[candidateId] || candidateId,
        votes: talliesByCandidate.get(candidateId) || 0,
      }))
      .sort((left, right) => {
        if (right.votes !== left.votes) {
          return right.votes - left.votes;
        }

        return compareCandidateIds(
          left.candidateId,
          right.candidateId,
          titlesByMovieId
        );
      });

    const majorityWinner =
      activeBallots > 0
        ? tallies.find((candidate) => candidate.votes >= threshold)
        : null;
    let winnerId: string | null = majorityWinner ? majorityWinner.candidateId : null;

    if (!winnerId && remainingIds.length === 1) {
      winnerId = remainingIds[0];
    }

    if (winnerId) {
      const winnerVotes = talliesByCandidate.get(winnerId) || 0;
      const winnerTitle = titlesByMovieId[winnerId] || winnerId;
      steps.push({
        id: `round-${roundNumber}-winner`,
        roundNumber,
        type: 'winner',
        title: 'We Have a Winner!',
        explanation:
          activeBallots > 0
            ? `${winnerTitle} wins with ${winnerVotes} of ${activeBallots} active votes.`
            : `${winnerTitle} is the final remaining movie and wins after all ballots were exhausted.`,
        activeBallots,
        threshold,
        exhaustedBallots: rankedBallots.length - activeBallots,
        newlyEliminated: [],
        candidates: buildCandidateStepState(
          candidateOrder,
          assignments,
          titlesByMovieId,
          eliminatedCandidateIds,
          winnerId
        ),
        voteMovements: [],
      });

      rounds.push({
        roundNumber,
        tallies,
        eliminated: [],
        transfers: [],
        activeBallots,
        threshold,
        winner: winnerId,
      });

      overallWinner = winnerId;
      break;
    }

    const leadingCandidate = tallies[0];
    if (!leadingCandidate) {
      break;
    }

    const lowestTally = Math.min(
      ...remainingIds.map((candidateId) => talliesByCandidate.get(candidateId) || 0)
    );
    const lowestCandidates = remainingIds
      .filter((candidateId) => (talliesByCandidate.get(candidateId) || 0) === lowestTally)
      .sort((leftId, rightId) =>
        compareCandidateIds(leftId, rightId, titlesByMovieId)
      );
    if (lowestCandidates.length === 0) {
      break;
    }

    if (lowestCandidates.length === remainingIds.length) {
      const tiebreakWinnerId = tallies[0]?.candidateId;
      if (!tiebreakWinnerId) {
        break;
      }

      const tiebreakWinnerTitle = titlesByMovieId[tiebreakWinnerId] || tiebreakWinnerId;
      steps.push({
        id: `round-${roundNumber}-winner-tiebreak`,
        roundNumber,
        type: 'winner',
        title: 'We Have a Winner!',
        explanation:
          activeBallots > 0
            ? `All remaining movies are tied at ${lowestTally} vote(s). ${tiebreakWinnerTitle} wins via tie-break.`
            : `${tiebreakWinnerTitle} wins via tie-break after all ballots were exhausted.`,
        activeBallots,
        threshold,
        exhaustedBallots: rankedBallots.length - activeBallots,
        newlyEliminated: [],
        candidates: buildCandidateStepState(
          candidateOrder,
          assignments,
          titlesByMovieId,
          eliminatedCandidateIds,
          tiebreakWinnerId
        ),
        voteMovements: [],
      });

      rounds.push({
        roundNumber,
        tallies,
        eliminated: [],
        transfers: [],
        activeBallots,
        threshold,
        winner: tiebreakWinnerId,
      });

      overallWinner = tiebreakWinnerId;
      break;
    }

    if (lowestTally === 0) {
      lowestCandidates.forEach((candidateId) => {
        eliminatedCandidateIds.add(candidateId);
      });
      const zeroTallySet = new Set(lowestCandidates);
      remainingCandidates = new Set(
        remainingIds.filter((candidateId) => !zeroTallySet.has(candidateId))
      );
      continue;
    }

    steps.push({
      id: `round-${roundNumber}-standings-start`,
      roundNumber,
      type: 'standings',
      title: `Round ${roundNumber} — Standings`,
      explanation: `No majority yet. ${leadingCandidate.title} leads with ${leadingCandidate.votes} of ${activeBallots} votes. ${threshold} needed to win.`,
      activeBallots,
      threshold,
      exhaustedBallots: rankedBallots.length - activeBallots,
      newlyEliminated: [],
      candidates: buildCandidateStepState(
        candidateOrder,
        assignments,
        titlesByMovieId,
        eliminatedCandidateIds,
        null
      ),
      voteMovements: [],
    });

    const phaseEliminated = [...lowestCandidates];
    const phaseEliminatedSet = new Set(phaseEliminated);
    const nextRemainingIds = remainingIds.filter((candidateId) => !phaseEliminatedSet.has(candidateId));
    const nextRemainingSet = new Set(nextRemainingIds);
    const nextAssignments = calculateAssignments(rankedBallots, nextRemainingSet);
    const progressiveAssignments = new Map(assignments);
    const phaseVoteMovements: VoteMovement[] = [];
    let phaseExhaustedVotes = 0;

    phaseEliminated.forEach((eliminatedCandidateId, phaseIndex) => {
      eliminatedCandidateIds.add(eliminatedCandidateId);
      const eliminatedTitle = titlesByMovieId[eliminatedCandidateId] || eliminatedCandidateId;

      const voteMovements: VoteMovement[] = [];
      const reassignedCountByCandidate = new Map<string, number>();
      let reassignedVotes = 0;
      let exhaustedVotes = 0;

      rankedBallots.forEach((ballot) => {
        const currentAssignment = assignments.get(ballot.ballotId);
        if (!currentAssignment?.candidateId) {
          return;
        }

        if (currentAssignment.candidateId !== eliminatedCandidateId) {
          return;
        }

        const nextAssignment = nextAssignments.get(ballot.ballotId) || {
          candidateId: null,
          rankIndex: null,
        };
        const nextRankIndex = nextAssignment.rankIndex ?? currentAssignment.rankIndex;

        voteMovements.push({
          tokenId: ballot.ballotId,
          ballotId: ballot.ballotId,
          fromCandidateId: currentAssignment.candidateId,
          fromEmoji: getRankEmoji(currentAssignment.rankIndex),
          toCandidateId: nextAssignment.candidateId,
          emoji: getRankEmoji(nextRankIndex),
        });
        progressiveAssignments.set(ballot.ballotId, nextAssignment);
      });

      voteMovements.forEach((movement) => {
        if (movement.toCandidateId) {
          reassignedVotes += 1;
          reassignedCountByCandidate.set(
            movement.toCandidateId,
            (reassignedCountByCandidate.get(movement.toCandidateId) || 0) + 1
          );
          return;
        }

        exhaustedVotes += 1;
      });
      phaseExhaustedVotes += exhaustedVotes;
      phaseVoteMovements.push(...voteMovements);

      const reassignedSummaryParts = Array.from(reassignedCountByCandidate.entries())
        .sort(([leftId], [rightId]) =>
          compareCandidateIds(leftId, rightId, titlesByMovieId)
        )
        .map(
          ([candidateId, votes]) =>
            `${votes} to ${titlesByMovieId[candidateId] || candidateId}`
        );

      const reassignedSummary =
        reassignedSummaryParts.length > 0
          ? reassignedSummaryParts.join(', ')
          : '0 to no remaining movies';

      const stepActiveBallots = countActiveAssignments(progressiveAssignments);
      const stepThreshold = getMajorityThreshold(stepActiveBallots);

      steps.push({
        id: `round-${roundNumber}-redistribution-${phaseIndex + 1}`,
        roundNumber,
        type: 'redistribution',
        title: 'Votes Reassigned',
        explanation: `${eliminatedTitle} eliminated. ${reassignedVotes} vote(s) reassigned: ${reassignedSummary}. ${exhaustedVotes} ballot(s) exhausted.`,
        activeBallots: stepActiveBallots,
        threshold: stepThreshold,
        exhaustedBallots: rankedBallots.length - stepActiveBallots,
        newlyEliminated: [eliminatedCandidateId],
        candidates: buildCandidateStepState(
          candidateOrder,
          progressiveAssignments,
          titlesByMovieId,
          eliminatedCandidateIds,
          null
        ),
        voteMovements,
      });
    });

    const nextActiveBallots = countActiveAssignments(nextAssignments);
    const nextThreshold = getMajorityThreshold(nextActiveBallots);

    if (phaseExhaustedVotes > 0 && nextThreshold !== threshold && nextActiveBallots > 0) {
      steps.push({
        id: `round-${roundNumber}-threshold-update`,
        roundNumber,
        type: 'threshold-update',
        title: 'Checking for a Majority...',
        explanation: `${phaseExhaustedVotes} ballot(s) exhausted. Majority is now ${nextThreshold} of ${nextActiveBallots} active ballots.`,
        activeBallots: nextActiveBallots,
        threshold: nextThreshold,
        exhaustedBallots: rankedBallots.length - nextActiveBallots,
        newlyEliminated: [],
        candidates: buildCandidateStepState(
          candidateOrder,
          nextAssignments,
          titlesByMovieId,
          eliminatedCandidateIds,
          null
        ),
        voteMovements: [],
      });
    }

    rounds.push({
      roundNumber,
      tallies,
      eliminated: phaseEliminated,
      transfers: buildTransferSummaries(phaseVoteMovements, titlesByMovieId),
      activeBallots,
      threshold,
      winner: null,
    });

    remainingCandidates = nextRemainingSet;
    roundNumber += 1;
  }

  return {
    rounds,
    winner: overallWinner,
    steps,
    candidateOrder,
    titlesByCandidateId,
  };
}
