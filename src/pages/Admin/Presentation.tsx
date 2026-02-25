import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllBallots,
  isIncludedInAnalysis,
} from '../../services/adminApi';
import {
  calculateParticipationStats,
  calculateRankedChoiceRounds,
  type ParticipationStats,
  type RcvComputationResult,
} from '../../utils/rcv';
import './Presentation.css';

interface PresentationData {
  stats: ParticipationStats;
  rcv: RcvComputationResult;
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const BALLOT_EMOJI = '🏆';
const expandEmojiTokens = (count: number, keyPrefix = 'ballot') =>
  Array.from({ length: count }, (_, index) => (
    <span key={`${keyPrefix}-${index}`}>{BALLOT_EMOJI}</span>
  ));

const Presentation = () => {
  const [data, setData] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [flightTokens, setFlightTokens] = useState<FlightToken[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const allBallots = await getAllBallots();
      const includedBallots = allBallots.filter(isIncludedInAnalysis);
      const stats = calculateParticipationStats(includedBallots, allBallots.length);
      const rcv = calculateRankedChoiceRounds(includedBallots);

      setData({ stats, rcv });
      setActiveStepIndex(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presentation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchData();
    };

    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [fetchData]);

  const totalSlides = useMemo(() => {
    if (!data) {
      return 0;
    }
    return data.rcv.steps.length;
  }, [data]);

  useEffect(() => {
    if (totalSlides === 0) {
      setActiveStepIndex(0);
      return;
    }

    setActiveStepIndex((current) => clamp(current, 0, totalSlides - 1));
  }, [totalSlides]);

  const goToPreviousStep = useCallback(() => {
    if (totalSlides === 0) {
      return;
    }
    setActiveStepIndex((current) => clamp(current - 1, 0, totalSlides - 1));
  }, [totalSlides]);

  const goToNextStep = useCallback(() => {
    if (totalSlides === 0) {
      return;
    }
    setActiveStepIndex((current) => clamp(current + 1, 0, totalSlides - 1));
  }, [totalSlides]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousStep();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextStep, goToPreviousStep]);

  const activeStep = data?.rcv.steps[activeStepIndex] ?? null;
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
      !data
    ) {
      return [];
    }

    const titlesByCandidateId = data.rcv.titlesByCandidateId || {};
    const phaseSteps = data.rcv.steps
      .slice(0, activeStepIndex + 1)
      .filter(
        (step) => step.type === 'redistribution' && step.roundNumber === activeStep.roundNumber
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
  }, [activeStep, activeStepIndex, data]);

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
            fromRect.left - boardRect.left + Math.min(fromRect.width - 28, 24 + horizontalOffset);
          const startY = fromRect.top - boardRect.top + fromRect.height - 34 - verticalOffset;
          const endX =
            toRect.left - boardRect.left + Math.min(toRect.width - 28, 24 + horizontalOffset);
          const endY = toRect.top - boardRect.top + toRect.height - 34 - verticalOffset;

          return {
            id: `${activeStep.id}-${movement.tokenId}`,
            emoji: movement.emoji,
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
        <button className="presentation-nav-button" onClick={fetchData}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="presentation-loading">No presentation data found.</div>;
  }

  if (!activeStep || totalSlides === 0) {
    return (
      <div className="presentation-page">
        <div className="presentation-topbar">
          <span className="presentation-kicker">Best Picture RCV</span>
          <span className="presentation-page-index">No ranked ballots to present</span>
        </div>
        <section className="presentation-slide">
          <div className="presentation-block">
            <h1>No ranked ballots</h1>
            <p className="presentation-muted">
              Included ballots: {data.stats.includedBallots} | Total submitted: {data.stats.totalBallots}
            </p>
          </div>
        </section>
        <div className="presentation-controls">
          <button className="presentation-nav-button secondary" onClick={fetchData}>
            Refresh Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="presentation-page">
      <div className="presentation-topbar">
        <span className="presentation-kicker">Best Picture RCV</span>
        <div className="presentation-top-actions">
          <span className="presentation-page-index">
            Step {activeStepIndex + 1} of {totalSlides}
          </span>
          <div className="presentation-controls top">
            <button
              className="presentation-nav-button"
              onClick={goToPreviousStep}
              disabled={activeStepIndex === 0}
            >
              Previous
            </button>
            <button className="presentation-nav-button secondary" onClick={fetchData}>
              Refresh Data
            </button>
            <button
              className="presentation-nav-button"
              onClick={goToNextStep}
              disabled={activeStepIndex === totalSlides - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <section className="presentation-slide">
        <div className="presentation-block presentation-rcv-block">
          <div className="presentation-step-copy">
            <h1>{activeStep.title}</h1>
            <p className="presentation-step-explanation">{activeStep.explanation}</p>
            {redistributionPanels.length > 0 && (
              <>
                <p className="presentation-transfer-note">
                  Each trophy represents one ballot reassigned in this phase.
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
                              <div className="presentation-transfer-origin-title">{source.title}</div>
                              <div className="presentation-transfer-origin-emojis">
                                {expandEmojiTokens(
                                  source.count,
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
                                    `${panel.stepId}-${destination.candidateId}-to`
                                  )}
                                </span>
                              </span>
                            </div>
                          ))}
                          {panel.exhaustedCount > 0 && (
                            <div className="presentation-transfer-destination-item">
                              <span className="presentation-transfer-destination-title">Exhausted</span>
                              <span className="presentation-transfer-delta-value">
                                +
                                <span className="presentation-transfer-delta-emojis">
                                  {expandEmojiTokens(panel.exhaustedCount, `${panel.stepId}-exhausted`)}
                                </span>
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
            <p className="presentation-threshold-line">
              {activeStep.threshold} votes needed to win — recalculated from {activeStep.activeBallots} active ballots.
            </p>
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
                      <span key={`${candidate.candidateId}-${token.tokenId}`}>{token.emoji}</span>
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
      </section>
    </div>
  );
};

export default Presentation;
