import "./Videos.css";

const segments = [
  {
    title: "Opening Medley",
    description: "The night begins.",
  },
  {
    title: "The NANAs",
    description: null,
  },
  {
    title: "The Carrie Awards",
    description: null,
  },
  {
    title: "The SAMMYs",
    subtitle: "with Medley!",
    description: null,
  },
  {
    title: "The Bucatinis",
    description: null,
  },
  {
    title: "The MAG Awards",
    description: null,
  },
  {
    title: "Maggie and Foster Song",
    description: null,
  },
  {
    title: "The Madame Web Medical Accuracy Awards",
    description: null,
  },
  {
    title: '"I\'m Good" Duet',
    description: null,
  },
  {
    title: "The Golden Kates",
    subtitle: "Critic's Corner",
    description: null,
  },
  {
    title: "The Thomonto Film Festival",
    description: null,
  },
  {
    title: '"No Hot Take" Song',
    description: null,
  },
  {
    title: "The Hangoria Awards",
    description: null,
  },
  {
    title: "The Adam Awards",
    description: null,
  },
  {
    title: "The Seanscars",
    description: "The grand finale.",
  },
];

const Videos = () => {
  return (
    <div className="videos-page">
      {/* Page Header */}
      <header className="videos-header">
        <div className="videos-header-inner">
          <p className="videos-eyebrow">2026 Award Sharemony</p>
          <h1 className="videos-title">
            The <span className="gold-text">Complete</span> Run of Show
          </h1>
          <div className="videos-divider">
            <span className="divider-gem">◆</span>
          </div>
          <p className="videos-subtitle">
            Every moment from the night, presented in order
          </p>
        </div>
      </header>

      {/* Video List */}
      <section className="videos-list">
        <div className="videos-container">
          {segments.map((segment, index) => (
            <article key={index} className="video-card">
              <div className="video-card-header">
                <span className="video-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="video-title-block">
                  <h2 className="video-title gold-text">{segment.title}</h2>
                  {segment.subtitle && (
                    <span className="video-subtitle">{segment.subtitle}</span>
                  )}
                </div>
              </div>

              <div className="video-embed-placeholder">
                <div className="embed-inner">
                  <div className="embed-icon">▶</div>
                  <p className="embed-label">Video coming soon</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer flourish */}
      <div className="videos-footer-flourish">
        <span className="flourish-gem">◆</span>
        <span className="flourish-line"></span>
        <span className="flourish-gem">◆</span>
        <span className="flourish-line"></span>
        <span className="flourish-gem">◆</span>
      </div>
    </div>
  );
};

export default Videos;
