import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import moviesData from '../../data/movies.json';
import {
  getAllBallots,
  isIncludedInAnalysis,
  type Ballot as AdminBallot,
} from '../../services/adminApi';
import { db } from '../../services/firebase';
import {
  calculateParticipationStats,
  calculateRankedChoiceRounds,
  type ParticipationStats,
  type RcvComputationResult,
  type RcvPresentationStep,
} from '../../utils/rcv';
import './Presentation.css';

type RecommendationFieldKey =
  | 'toParents'
  | 'toKid'
  | 'underseenGem'
  | 'toFreakiestFriend'
  | 'leastFavorite';

type RecommendationTileSize = 'xs' | 's' | 'm' | 'l' | 'xl';

interface RecommendationSlideConfig {
  key: RecommendationFieldKey;
  title: string;
  prompt: string;
}

interface RecommendationCloudItem {
  movieId: string;
  title: string;
  count: number;
  size: RecommendationTileSize;
}

interface RecommendationCloudRow {
  count: number;
  items: RecommendationCloudItem[];
}

interface RecommendationSlideData {
  id: RecommendationFieldKey;
  title: string;
  prompt: string;
  responsesCount: number;
  rows: RecommendationCloudRow[];
}

interface PresentationData {
  overview: {
    ballotsReceived: number;
    moviesSeen: number;
  };
  stats: ParticipationStats;
  rcv: RcvComputationResult;
  recommendationSlides: RecommendationSlideData[];
}

interface FlightToken {
  id: string;
  emoji: string;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  active: boolean;
}

type PresentationSlide =
  | {
      kind: 'overview';
    }
  | {
      kind: 'recommendation-intro';
      recommendation: RecommendationSlideData;
    }
  | {
      kind: 'recommendation-cloud';
      recommendation: RecommendationSlideData;
    }
  | {
      kind: 'rcv';
      step: RcvPresentationStep;
      rcvStepIndex: number;
    };

const RECOMMENDATION_TOP_LIMIT = 20;
const RECOMMENDATION_SLIDES: RecommendationSlideConfig[] = [
  {
    key: 'toParents',
    title: 'Recommendations: Parents',
    prompt: "Movies you'd recommend to your parents",
  },
  {
    key: 'toKid',
    title: 'Recommendations: 9-year-old niece or nephew',
    prompt: "Movies you'd recommend to your 9-year-old niece or nephew",
  },
  {
    key: 'underseenGem',
    title: 'Recommendations: Underseen gem',
    prompt: 'Underseen gems more people should see',
  },
  {
    key: 'toFreakiestFriend',
    title: 'Recommendations: Freakiest friend',
    prompt: "Movies you'd recommend to your freakiest friend",
  },
  {
    key: 'leastFavorite',
    title: 'Least Favorite',
    prompt: 'Least favorite movies',
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const BALLOT_EMOJI = '🏆';
const EXHAUSTED_EMOJI = '💨';

const expandEmojiTokens = (
  count: number,
  emoji: string,
  keyPrefix = 'token'
) =>
  Array.from({ length: count }, (_, index) => (
    <span key={`${keyPrefix}-${index}`}>{emoji}</span>
  ));

const buildMovieTitleMap = (ballots: AdminBallot[]) => {
  const titlesByMovieId = new Map<string, string>();
  moviesData.forEach((movie) => {
    titlesByMovieId.set(movie.id, movie.title);
  });

  ballots.forEach((ballot) => {
    ballot.movies.forEach((movie) => {
      if (!movie.id) {
        return;
      }

      if (!titlesByMovieId.has(movie.id) && movie.title) {
        titlesByMovieId.set(movie.id, movie.title);
      }
    });
  });

  return titlesByMovieId;
};

const getRecommendationTileSize = (
  count: number,
  minCount: number,
  maxCount: number
): RecommendationTileSize => {
  if (maxCount === minCount) {
    return 'm';
  }

  const ratio = (count - minCount) / (maxCount - minCount);
  if (ratio >= 0.8) {
    return 'xl';
  }
  if (ratio >= 0.6) {
    return 'l';
  }
  if (ratio >= 0.4) {
    return 'm';
  }
  if (ratio >= 0.2) {
    return 's';
  }
  return 'xs';
};

const buildRecommendationSlides = (
  includedBallots: AdminBallot[]
): RecommendationSlideData[] => {
  const titlesByMovieId = buildMovieTitleMap(includedBallots);

  return RECOMMENDATION_SLIDES.map((slideConfig) => {
    const countsByMovieId = new Map<string, number>();

    includedBallots.forEach((ballot) => {
      const recommendationValue = ballot.recommendations?.[slideConfig.key];
      if (typeof recommendationValue !== 'string') {
        return;
      }

      const normalizedValue = recommendationValue.trim();
      if (!normalizedValue) {
        return;
      }

      countsByMovieId.set(
        normalizedValue,
        (countsByMovieId.get(normalizedValue) || 0) + 1
      );
    });

    const sortedEntries = Array.from(countsByMovieId.entries())
      .map(([movieId, count]) => ({
        movieId,
        count,
        title: titlesByMovieId.get(movieId) || movieId,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        const titleComparison = left.title.localeCompare(right.title);
        if (titleComparison !== 0) {
          return titleComparison;
        }

        return left.movieId.localeCompare(right.movieId);
      });

    const topEntries = sortedEntries.slice(0, RECOMMENDATION_TOP_LIMIT);
    const counts = topEntries.map((entry) => entry.count);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    const minCount = counts.length > 0 ? Math.min(...counts) : 0;

    const items = topEntries.map((entry) => ({
      movieId: entry.movieId,
      title: entry.title,
      count: entry.count,
      size: getRecommendationTileSize(entry.count, minCount, maxCount),
    }));

    const rowsByCount = new Map<number, RecommendationCloudItem[]>();
    items.forEach((item) => {
      const existingRow = rowsByCount.get(item.count) || [];
      existingRow.push(item);
      rowsByCount.set(item.count, existingRow);
    });

    const rows = Array.from(rowsByCount.entries())
      .sort((left, right) => right[0] - left[0])
      .map(([count, rowItems]) => ({
        count,
        items: [...rowItems].sort((left, right) => {
          const titleComparison = left.title.localeCompare(right.title);
          if (titleComparison !== 0) {
            return titleComparison;
          }
          return left.movieId.localeCompare(right.movieId);
        }),
      }));

    return {
      id: slideConfig.key,
      title: slideConfig.title,
      prompt: slideConfig.prompt,
      responsesCount: sortedEntries.reduce(
        (totalCount, entry) => totalCount + entry.count,
        0
      ),
      rows,
    };
  });
};

const buildPresentationData = (allBallots: AdminBallot[]): PresentationData => {
  const includedBallots = allBallots.filter(isIncludedInAnalysis);
  const stats = calculateParticipationStats(includedBallots, allBallots.length);
  const rcv = calculateRankedChoiceRounds(includedBallots);
  const recommendationSlides = buildRecommendationSlides(includedBallots);
  const overview = {
    ballotsReceived: allBallots.length,
    moviesSeen: allBallots.reduce(
      (total, ballot) => total + ballot.movies.filter((movie) => movie.seen).length,
      0
    ),
  };

  return { overview, stats, rcv, recommendationSlides };
};

const getRcvDisplayCopy = (step: RcvPresentationStep) => {
  if (step.type === 'winner') {
    const winnerCandidate =
      step.candidates.find((candidate) => candidate.status === 'winner') ||
      [...step.candidates]
        .filter((candidate) => candidate.votes > 0)
        .sort((left, right) => {
          if (right.votes !== left.votes) {
            return right.votes - left.votes;
          }
          return left.title.localeCompare(right.title);
        })[0];

    return {
      title: winnerCandidate
        ? `${winnerCandidate.title} has won.`
        : 'We have a winner.',
      subtitle: '',
    };
  }

  const eliminatedCandidateId = step.newlyEliminated[0];
  const eliminatedCandidate = eliminatedCandidateId
    ? step.candidates.find((candidate) => candidate.candidateId === eliminatedCandidateId)
    : null;

  const leadingCandidate = [...step.candidates]
    .filter((candidate) => candidate.status !== 'eliminated')
    .sort((left, right) => {
      if (right.votes !== left.votes) {
        return right.votes - left.votes;
      }
      return left.title.localeCompare(right.title);
    })[0];

  return {
    title: eliminatedCandidate
      ? `${eliminatedCandidate.title} ballots have been exhausted.`
      : 'Some ballots have been exhausted.',
    subtitle: leadingCandidate
      ? `${leadingCandidate.title} is in the lead.`
      : '',
  };
};

const Presentation = () => {
  const [data, setData] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [flightTokens, setFlightTokens] = useState<FlightToken[]>([]);
  const [liveUpdatesLocked, setLiveUpdatesLocked] = useState(false);

  const applyBallots = useCallback((allBallots: AdminBallot[]) => {
    setData(buildPresentationData(allBallots));
    setError(null);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const allBallots = await getAllBallots();
      applyBallots(allBallots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presentation');
    } finally {
      setLoading(false);
    }
  }, [applyBallots]);

  useEffect(() => {
    if (liveUpdatesLocked) {
      return;
    }

    setLoading(true);

    const ballotsQuery = query(collection(db, 'ballots'));
    const unsubscribe = onSnapshot(
      ballotsQuery,
      (snapshot) => {
        const allBallots = snapshot.docs.map(
          (docSnapshot) =>
            ({
              id: docSnapshot.id,
              ...docSnapshot.data(),
            } as AdminBallot)
        );

        applyBallots(allBallots);
        setLoading(false);
      },
      (snapshotError) => {
        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : 'Failed to subscribe to ballots'
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [applyBallots, liveUpdatesLocked]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      if (liveUpdatesLocked) {
        return;
      }
      void refreshData();
    };

    window.addEventListener('refresh-data', handleRefreshEvent);
    return () => window.removeEventListener('refresh-data', handleRefreshEvent);
  }, [liveUpdatesLocked, refreshData]);

  const slides = useMemo<PresentationSlide[]>(() => {
    if (!data) {
      return [];
    }

    const rcvSlides = data.rcv.steps
      .map((step, rcvStepIndex) => ({
        kind: 'rcv' as const,
        step,
        rcvStepIndex,
      }))
      .filter(
        (slide) =>
          slide.step.type === 'redistribution' || slide.step.type === 'winner'
      );

    return [
      { kind: 'overview' },
      ...data.recommendationSlides.flatMap((recommendation) => [
        {
          kind: 'recommendation-intro' as const,
          recommendation,
        },
        {
          kind: 'recommendation-cloud' as const,
          recommendation,
        },
      ]),
      ...rcvSlides,
    ];
  }, [data]);

  const totalSlides = slides.length;

  useEffect(() => {
    if (totalSlides === 0) {
      setActiveSlideIndex(0);
      return;
    }

    setActiveSlideIndex((current) => clamp(current, 0, totalSlides - 1));
  }, [totalSlides]);

  const goToPreviousSlide = useCallback(() => {
    if (totalSlides === 0) {
      return;
    }

    setActiveSlideIndex((current) => clamp(current - 1, 0, totalSlides - 1));
  }, [totalSlides]);

  const goToNextSlide = useCallback(() => {
    if (totalSlides === 0) {
      return;
    }

    setActiveSlideIndex((current) => {
      const next = clamp(current + 1, 0, totalSlides - 1);
      if (current === 0 && next > 0) {
        setLiveUpdatesLocked(true);
      }
      return next;
    });
  }, [totalSlides]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousSlide();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextSlide();
      } else if (event.key === 'r' || event.key === 'R') {
        if (liveUpdatesLocked) {
          return;
        }
        event.preventDefault();
        void refreshData();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextSlide, goToPreviousSlide, liveUpdatesLocked, refreshData]);

  const activeSlide = slides[activeSlideIndex] ?? null;
  const activeStep = activeSlide?.kind === 'rcv' ? activeSlide.step : null;
  const visibleCandidates = useMemo(() => {
    if (!activeStep) {
      return [];
    }

    return [...activeStep.candidates]
      .filter((candidate) => candidate.votes > 0)
      .sort((left, right) => {
        if (right.votes !== left.votes) {
          return right.votes - left.votes;
        }

        return left.title.localeCompare(right.title);
      });
  }, [activeStep]);

  const redistributionPanels = useMemo(() => {
    if (
      !activeStep ||
      activeStep.type !== 'redistribution' ||
      activeStep.voteMovements.length === 0 ||
      !data ||
      !activeSlide ||
      activeSlide.kind !== 'rcv'
    ) {
      return [];
    }

    const titlesByCandidateId = data.rcv.titlesByCandidateId || {};
    const phaseSteps = data.rcv.steps
      .slice(0, activeSlide.rcvStepIndex + 1)
      .filter(
        (step) =>
          step.type === 'redistribution' &&
          step.roundNumber === activeStep.roundNumber
      );

    return [...phaseSteps].reverse().map((step) => {
      const fromCountsByCandidate = new Map<string, number>();
      const toCountsByCandidate = new Map<string, number>();
      let exhaustedCount = 0;

      step.voteMovements.forEach((movement) => {
        fromCountsByCandidate.set(
          movement.fromCandidateId,
          (fromCountsByCandidate.get(movement.fromCandidateId) || 0) + 1
        );

        if (movement.toCandidateId) {
          toCountsByCandidate.set(
            movement.toCandidateId,
            (toCountsByCandidate.get(movement.toCandidateId) || 0) + 1
          );
        } else {
          exhaustedCount += 1;
        }
      });

      const from = Array.from(fromCountsByCandidate.entries())
        .map(([candidateId, count]) => ({
          candidateId,
          title: titlesByCandidateId[candidateId] || candidateId,
          count,
        }))
        .sort((left, right) => right.count - left.count);

      const to = Array.from(toCountsByCandidate.entries())
        .map(([candidateId, count]) => ({
          candidateId,
          title: titlesByCandidateId[candidateId] || candidateId,
          count,
        }))
        .sort((left, right) => right.count - left.count);

      return {
        stepId: step.id,
        from,
        to,
        exhaustedCount,
      };
    });
  }, [activeSlide, activeStep, data]);

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const boardRef = useRef<HTMLElement | null>(null);
  const exhaustedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (
      !activeStep ||
      activeStep.type !== 'redistribution' ||
      activeStep.voteMovements.length === 0
    ) {
      setFlightTokens([]);
      return;
    }

    let measureFrame = 0;
    let animateFrame = 0;
    let cleanupTimeout = 0;

    measureFrame = window.requestAnimationFrame(() => {
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (!boardRect) {
        return;
      }

      const tokens: FlightToken[] = activeStep.voteMovements
        .map((movement, index) => {
          const fromCard = cardRefs.current[movement.fromCandidateId];
          const toCard = movement.toCandidateId
            ? cardRefs.current[movement.toCandidateId]
            : exhaustedRef.current;

          if (!fromCard || !toCard) {
            return null;
          }

          const fromRect = fromCard.getBoundingClientRect();
          const toRect = toCard.getBoundingClientRect();
          const horizontalOffset = (index % 8) * 12;
          const verticalOffset = Math.floor(index / 8) * 8;

          const startX =
            fromRect.left -
            boardRect.left +
            Math.min(fromRect.width - 28, 24 + horizontalOffset);
          const startY =
            fromRect.top - boardRect.top + fromRect.height - 34 - verticalOffset;
          const endX =
            toRect.left -
            boardRect.left +
            Math.min(toRect.width - 28, 24 + horizontalOffset);
          const endY =
            toRect.top - boardRect.top + toRect.height - 34 - verticalOffset;

          return {
            id: `${activeStep.id}-${movement.tokenId}`,
            emoji: movement.toCandidateId ? BALLOT_EMOJI : EXHAUSTED_EMOJI,
            startX,
            startY,
            deltaX: endX - startX,
            deltaY: endY - startY,
            active: false,
          };
        })
        .filter((token): token is FlightToken => token !== null);

      setFlightTokens(tokens);
      animateFrame = window.requestAnimationFrame(() => {
        setFlightTokens((current) =>
          current.map((token) => ({
            ...token,
            active: true,
          }))
        );
      });

      cleanupTimeout = window.setTimeout(() => {
        setFlightTokens([]);
      }, 760);
    });

    return () => {
      window.cancelAnimationFrame(measureFrame);
      window.cancelAnimationFrame(animateFrame);
      window.clearTimeout(cleanupTimeout);
    };
  }, [activeStep]);

  if (loading) {
    return <div className="presentation-loading">Loading presentation...</div>;
  }

  if (error) {
    return (
      <div className="presentation-loading">
        <div className="presentation-error">{error}</div>
        <p className="presentation-muted">Press R to refresh data.</p>
      </div>
    );
  }

  if (!data || !activeSlide || totalSlides === 0) {
    return <div className="presentation-loading">No presentation data found.</div>;
  }

  return (
    <div className="presentation-page">
      <section className="presentation-slide">
        {activeSlide.kind === 'overview' && (
          <div className="presentation-block presentation-overview-block">
            <div className="presentation-overview-hero">
              <h1>Ballots received</h1>
              <p>{data.overview.ballotsReceived}</p>
            </div>
            <div className="presentation-overview-hero">
              <h2>Movies seen</h2>
              <p>{data.overview.moviesSeen}</p>
            </div>
          </div>
        )}

        {activeSlide.kind === 'recommendation-intro' && (
          <div className="presentation-block presentation-recommendation-intro-block">
            <h1>{activeSlide.recommendation.title}</h1>
            <p className="presentation-step-explanation">
              {activeSlide.recommendation.prompt}
            </p>
          </div>
        )}

        {activeSlide.kind === 'recommendation-cloud' && (
          <div className="presentation-block presentation-recommendation-block">
            <h1>{activeSlide.recommendation.title}</h1>
            <p className="presentation-threshold-line">
              {activeSlide.recommendation.responsesCount} response
              {activeSlide.recommendation.responsesCount === 1 ? '' : 's'}
            </p>
            {activeSlide.recommendation.rows.length === 0 ? (
              <p className="presentation-muted">No responses yet.</p>
            ) : (
              <div className="presentation-recommendation-cloud-rows">
                {activeSlide.recommendation.rows.map((row) => (
                  <div
                    key={`${activeSlide.recommendation.id}-count-${row.count}`}
                    className="presentation-cloud-row"
                  >
                    {row.items.map((item) => (
                      <article
                        key={`${activeSlide.recommendation.id}-${item.movieId}`}
                        className={`presentation-cloud-item size-${item.size}`}
                      >
                        <span className="presentation-cloud-title">{item.title}</span>
                        <span className="presentation-cloud-count">x{item.count}</span>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSlide.kind === 'rcv' && activeStep && (
          <div className="presentation-block presentation-rcv-block">
            <div className="presentation-step-copy">
              <h1>{getRcvDisplayCopy(activeStep).title}</h1>
              {getRcvDisplayCopy(activeStep).subtitle && (
                <p className="presentation-step-explanation">
                  {getRcvDisplayCopy(activeStep).subtitle}
                </p>
              )}
              {redistributionPanels.length > 0 && (
                <>
                  <p className="presentation-transfer-note">
                    Each trophy shows where ballots moved next.
                  </p>
                  <div className="presentation-transfer-panels">
                    {redistributionPanels.map((panel) => (
                      <div className="presentation-transfer-phase" key={panel.stepId}>
                        <div className="presentation-transfer-visual">
                          <section className="presentation-transfer-origin-panel">
                            {panel.from.map((source) => (
                              <article
                                className="presentation-transfer-origin-item"
                                key={source.candidateId}
                              >
                                <div className="presentation-transfer-origin-title">
                                  {source.title}
                                </div>
                                <div className="presentation-transfer-origin-emojis">
                                  {expandEmojiTokens(
                                    source.count,
                                    BALLOT_EMOJI,
                                    `${panel.stepId}-${source.candidateId}-from`
                                  )}
                                </div>
                              </article>
                            ))}
                          </section>
                          <div className="presentation-transfer-arrow" aria-hidden="true">
                            →
                          </div>
                          <section className="presentation-transfer-destination-panel">
                            {panel.to.map((destination) => (
                              <div
                                className="presentation-transfer-destination-item"
                                key={destination.candidateId}
                              >
                                <span className="presentation-transfer-destination-title">
                                  {destination.title}
                                </span>
                                <span className="presentation-transfer-delta-value">
                                  +
                                  <span className="presentation-transfer-delta-emojis">
                                    {expandEmojiTokens(
                                      destination.count,
                                      BALLOT_EMOJI,
                                      `${panel.stepId}-${destination.candidateId}-to`
                                    )}
                                  </span>
                                </span>
                              </div>
                            ))}
                            {panel.exhaustedCount > 0 && (
                              <div className="presentation-transfer-destination-item exhausted">
                                <span className="presentation-transfer-destination-title">
                                  Exhausted
                                </span>
                                <span className="presentation-transfer-exhausted-emojis">
                                  {expandEmojiTokens(
                                    panel.exhaustedCount,
                                    EXHAUSTED_EMOJI,
                                    `${panel.stepId}-exhausted`
                                  )}
                                </span>
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div
              className="presentation-board"
              ref={(element) => {
                boardRef.current = element;
              }}
            >
              <div className="presentation-cards-list">
                {visibleCandidates.map((candidate) => (
                  <article
                    key={candidate.candidateId}
                    className={`presentation-movie-card ${candidate.status} ${
                      activeStep.newlyEliminated.includes(candidate.candidateId)
                        ? 'newly-eliminated'
                        : ''
                    }`}
                    ref={(element) => {
                      cardRefs.current[candidate.candidateId] = element;
                    }}
                  >
                    <h2>{candidate.title}</h2>
                    <div className="presentation-emoji-stack">
                      {candidate.tokens.map((token) => (
                        <span key={`${candidate.candidateId}-${token.tokenId}`}>
                          {token.emoji}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <aside
                className="presentation-exhausted"
                ref={(element) => {
                  exhaustedRef.current = element;
                }}
              >
                <h3>Exhausted Ballots</h3>
                <p>{activeStep.exhaustedBallots}</p>
              </aside>

              <div className="presentation-flight-layer">
                {flightTokens.map((token) => (
                  <span
                    key={token.id}
                    className={`presentation-flight-token ${token.active ? 'active' : ''}`}
                    style={{
                      left: `${token.startX}px`,
                      top: `${token.startY}px`,
                      transform: token.active
                        ? `translate(${token.deltaX}px, ${token.deltaY}px)`
                        : 'translate(0, 0)',
                    }}
                  >
                    {token.emoji}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Presentation;
