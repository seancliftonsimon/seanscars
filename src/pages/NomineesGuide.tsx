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
const embeddedUrlRegex = /(https?:\/\/[^\s<]+)/;

type WatchTag = {
  key: string;
  label: string;
  url: string | null;
  brandClass: string;
};

const splitMultiline = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const splitWatchTokens = (value: string) =>
  value
    .split(/\n|,/)
    .map((token) => token.trim())
    .filter(Boolean);

const parseNumericRating = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeServiceName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();

const brandClassForService = (normalizedLabel: string) => {
  if (normalizedLabel === 'netflix') return 'brand-netflix';
  if (normalizedLabel === 'hulu') return 'brand-hulu';
  if (normalizedLabel === 'kanopy') return 'brand-kanopy';
  if (normalizedLabel === 'hbo max' || normalizedLabel === 'max') return 'brand-max';
  if (normalizedLabel === 'apple tv+' || normalizedLabel === 'apple tv plus') return 'brand-apple';
  if (normalizedLabel === 'amazon prime' || normalizedLabel === 'prime video') return 'brand-prime';
  if (normalizedLabel === 'paramount plus' || normalizedLabel === 'paramount+') return 'brand-paramount';
  if (normalizedLabel === 'theatres' || normalizedLabel === 'theaters') return 'brand-theaters';
  if (normalizedLabel === 'rent buy' || normalizedLabel === 'rent/buy') return 'brand-rent';
  if (normalizedLabel === 'n a') return 'brand-na';
  return 'brand-generic';
};

const starsFromRating = (rating: string) => {
  const numericRating = parseNumericRating(rating);
  if (numericRating === null) {
    return rating;
  }

  const rounded = Math.round(numericRating * 2) / 2;
  const fullStars = Math.floor(rounded);
  const hasHalfStar = rounded - fullStars >= 0.5;
  const fullText = '★'.repeat(fullStars);
  return hasHalfStar ? `${fullText}½` : fullText;
};

const extractRawUrls = (value: string) => value.match(/https?:\/\/[^\s,]+/g) ?? [];

const buildWatchTags = (
  filmTitle: string,
  streamingTokens: string[],
  otherOptionTokens: string[],
  rawStreamingUrls: string[]
): WatchTag[] => {
  const seen = new Set<string>();
  const tags: WatchTag[] = [];
  let urlIndex = 0;

  const addTag = (token: string, canConsumeStreamingUrl: boolean) => {
    const embeddedUrlMatch = token.match(embeddedUrlRegex);
    const embeddedUrl = embeddedUrlMatch?.[1] ?? null;
    const labelWithoutUrl = embeddedUrl ? token.replace(embeddedUrl, '').trim() : token;
    const baseLabel = labelWithoutUrl || token;
    const normalized = normalizeServiceName(baseLabel);

    let url: string | null = null;
    if (urlMatchRegex.test(token)) {
      url = token;
    } else if (embeddedUrl) {
      url = embeddedUrl;
    } else if (canConsumeStreamingUrl && normalized !== 'n a' && urlIndex < rawStreamingUrls.length) {
      // Match raw URLs from the CSV to streaming providers in order.
      url = rawStreamingUrls[urlIndex++];
    } else if (normalized === 'rent buy' || normalized === 'rent/buy') {
      url = `https://www.google.com/search?q=${encodeURIComponent(`where to rent ${filmTitle}`)}`;
    }

    const key = `${baseLabel.toLowerCase()}|${url ?? 'no-url'}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    tags.push({
      key,
      label: baseLabel,
      url,
      brandClass: brandClassForService(normalized),
    });
  };

  streamingTokens.forEach((token) => addTag(token, true));
  otherOptionTokens.forEach((token) => addTag(token, false));

  return tags;
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
          <h1 className="fade-in nominees-guide-title">
            <span className="nominees-guide-title-line">2026 Adam Awards</span>
            <span className="nominees-guide-title-line">Nominees Guide</span>
          </h1>
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

          <p className="nominees-guide-results-count">
            Showing all <strong>{orderedEntries.length}</strong> movies
          </p>

          <div className="nominees-guide-grid">
            {orderedEntries.map((entry) => {
              const recommendationLines = splitMultiline(entry.recommendTo);
              const nominationLines = splitMultiline(entry.nominations);
              const watchTags = buildWatchTags(
                entry.film,
                splitWatchTokens(entry.streaming),
                splitWatchTokens(entry.otherOptions),
                extractRawUrls(entry.streamingLinks)
              );

              return (
                <article key={entry.film} className="nominees-guide-card card fade-in">
                  <header className="nominees-guide-card-header">
                    <h2>{entry.film}</h2>
                    <div className="nominees-guide-rating-chip" aria-label={`Rating ${entry.myRating}`}>
                      <span>{starsFromRating(entry.myRating)}</span>
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
                    <div className="nominees-guide-service-tags">
                      {watchTags.length > 0 ? (
                        watchTags.map((tag) =>
                          tag.url ? (
                            <a
                              key={`${entry.film}-${tag.key}`}
                              href={tag.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`nominees-guide-service-tag ${tag.brandClass}`}
                            >
                              {tag.label}
                            </a>
                          ) : (
                            <span
                              key={`${entry.film}-${tag.key}`}
                              className={`nominees-guide-service-tag ${tag.brandClass}`}
                            >
                              {tag.label}
                            </span>
                          )
                        )
                      ) : (
                        <span className="nominees-guide-service-tag brand-na">N/A</span>
                      )}
                    </div>
                  </div>

                  <div className="nominees-guide-section">
                    <h3>
                      <Users size={16} />
                      Recommend to
                    </h3>
                    {recommendationLines.length > 0 ? (
                      recommendationLines.map((line, index) => (
                        <p key={`${entry.film}-recommend-${index}`} className="nominees-guide-line">
                          {renderLinkifiedLine(line)}
                        </p>
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
                    {nominationLines.length > 0 ? (
                      nominationLines.map((line, index) => (
                        <p
                          key={`${entry.film}-nomination-${index}`}
                          className={`nominees-guide-line ${line.includes('*') ? 'winner' : ''}`}
                        >
                          {renderLinkifiedLine(line)}
                        </p>
                      ))
                    ) : (
                      <p>N/A</p>
                    )}
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
