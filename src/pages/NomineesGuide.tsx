import { useMemo } from 'react';
import {
  Award,
  Film,
  Star,
  Tv,
  Users,
} from 'lucide-react';
import { nomineesGuideData } from '../data/nomineesGuideData';
import './NomineesGuide.css';

const urlSplitRegex = /(https?:\/\/[^\s<]+)/g;
const urlMatchRegex = /^https?:\/\/[^\s<]+$/;

const splitMultiline = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const parseNumericRating = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const NomineesGuide = () => {
  const orderedEntries = useMemo(
    () => [...nomineesGuideData].sort((a, b) => a.film.localeCompare(b.film)),
    []
  );

  const averageRating = useMemo(() => {
    const numericRatings = nomineesGuideData
      .map((entry) => parseNumericRating(entry.myRating))
      .filter((rating): rating is number => rating !== null);
    if (numericRatings.length === 0) {
      return 'N/A';
    }

    const total = numericRatings.reduce((sum, rating) => sum + rating, 0);
    return (total / numericRatings.length).toFixed(2);
  }, []);

  const winnerTagCount = useMemo(
    () =>
      nomineesGuideData.reduce(
        (total, entry) =>
          total +
          splitMultiline(entry.nominations).filter((line) => line.includes('*'))
            .length,
        0
      ),
    []
  );

  const renderLinkifiedLine = (line: string) => {
    const parts = line.split(urlSplitRegex);
    return parts.map((part, index) => {
      if (urlMatchRegex.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="nominees-guide-link"
          >
            {part}
          </a>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  return (
    <div className="nominees-guide-page">
      <div className="nominees-guide-hero">
        <div className="container">
          <h1 className="fade-in">2026 Nominees Guide</h1>
          <p className="nominees-guide-subtitle fade-in">
            A complete reference for every film, recommendation, platform, and nomination from the spreadsheet.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="nominees-guide-stats fade-in">
            <div className="nominees-guide-stat-card">
              <Film size={20} />
              <span>{nomineesGuideData.length} movies tracked</span>
            </div>
            <div className="nominees-guide-stat-card">
              <Star size={20} />
              <span>{averageRating} average rating</span>
            </div>
            <div className="nominees-guide-stat-card">
              <Award size={20} />
              <span>{winnerTagCount} winner tags (*)</span>
            </div>
          </div>

          <p className="nominees-guide-intro card slide-in-left">
            Browse every nominee below in alphabetical order. Each card preserves the original spreadsheet details:
            rating, genre, viewing options, recommendation notes, and nominations.
          </p>

          <p className="nominees-guide-results-count">
            Showing all <strong>{orderedEntries.length}</strong> movies
          </p>

          <div className="nominees-guide-grid">
            {orderedEntries.map((entry) => {
              const streamingLines = splitMultiline(entry.streaming);
              const recommendationLines = splitMultiline(entry.recommendTo);
              const nominationLines = splitMultiline(entry.nominations);

              return (
                <article key={entry.film} className="nominees-guide-card card fade-in">
                  <header className="nominees-guide-card-header">
                    <h2>{entry.film}</h2>
                    <div className="nominees-guide-rating-chip" aria-label={`Rating ${entry.myRating}`}>
                      <Star size={14} />
                      <span>{entry.myRating}</span>
                    </div>
                  </header>

                  <div className="nominees-guide-tags">
                    <span className="nominees-guide-tag">{entry.mpaaRating}</span>
                    <span className="nominees-guide-tag">{entry.genre}</span>
                  </div>

                  <div className="nominees-guide-section">
                    <h3>
                      <Tv size={16} />
                      Where to watch
                    </h3>
                    <ul>
                      {streamingLines.length > 0 ? (
                        streamingLines.map((line, index) => <li key={`${entry.film}-streaming-${index}`}>{renderLinkifiedLine(line)}</li>)
                      ) : (
                        <li>N/A</li>
                      )}
                    </ul>
                    <p className="nominees-guide-other-options">
                      <strong>Other options:</strong> {renderLinkifiedLine(entry.otherOptions || 'N/A')}
                    </p>
                  </div>

                  <div className="nominees-guide-section">
                    <h3>
                      <Users size={16} />
                      Recommend to
                    </h3>
                    {recommendationLines.length > 0 ? (
                      recommendationLines.map((line, index) => (
                        <p key={`${entry.film}-recommend-${index}`}>{renderLinkifiedLine(line)}</p>
                      ))
                    ) : (
                      <p>N/A</p>
                    )}
                  </div>

                  <div className="nominees-guide-section">
                    <h3>
                      <Award size={16} />
                      Nominations
                    </h3>
                    <ul>
                      {nominationLines.map((line, index) => (
                        <li
                          key={`${entry.film}-nomination-${index}`}
                          className={line.includes('*') ? 'winner' : ''}
                        >
                          {renderLinkifiedLine(line)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default NomineesGuide;
