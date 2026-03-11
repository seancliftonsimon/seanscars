import "./Videos.css";

interface Segment {
  title: string;
  subtitle?: string;
  embedId?: string;
  extraEmbed?: {
    id: string;
    label: string;
  };
}

const segments: Segment[] = [
  {
    title: "Opening Medley",
    embedId: "nVziX5SFaew",
  },
  {
    title: "The NANAs",
    embedId: "WoctmUiXaL4",
  },
  {
    title: "The Carrie Awards",
    embedId: "xIchD8iPKtg",
  },
  {
    title: "The SAMMYs",
    subtitle: "with Medley!",
    embedId: "aS26gipR44M",
  },
  {
    title: "The Bucatinis",
    embedId: "iVsXrkxGvMI",
  },
  {
    title: "The MAG Awards",
    embedId: "tL1qLtkvpOM",
  },
  {
    title: "Maggie and Foster Song",
    subtitle: '"I\'m Not Tom Cruise"',
    embedId: "Mbsw8pDhZBg",
  },
  {
    title: "The Madame Web Medical Accuracy Awards",
    embedId: "a6veB32Cop4",
  },
  {
    title: '"I\'m Good" Duet',
    embedId: "NhE_e0uhX4k",
  },
  {
    title: "The Golden Kates",
    subtitle: "Critic's Corner",
    embedId: "bKkpuYHZr_M",
  },
  {
    title: "The Thomonto Film Festival",
    embedId: "Cnk911xiCfQ",
  },
  {
    title: '"No Hot Take" Song',
    embedId: "JGgz_-LPJBA",
  },
  {
    title: "The Hangoria Awards",
    embedId: "gxNA1-lvEe8",
  },
  {
    title: "The Adam Awards",
    embedId: "UkIZVcZnOgk",
  },
  {
    title: "The Seanscars",
    // Coming soon
  },
];

const YOUTUBE_PARAMS =
  "?rel=0&modestbranding=1&color=white";

function VideoEmbed({ id, label }: { id: string; label?: string }) {
  return (
    <div className="video-embed-wrap">
      {label && <p className="extra-embed-label">{label}</p>}
      <div className="video-embed-frame">
        <iframe
          src={`https://www.youtube.com/embed/${id}${YOUTUBE_PARAMS}`}
          title={label ?? "Award Sharemony Video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function VideoPlaceholder() {
  return (
    <div className="video-embed-placeholder">
      <div className="embed-inner">
        <div className="embed-icon">▶</div>
        <p className="embed-label">Video coming soon</p>
      </div>
    </div>
  );
}

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

              <div className="video-embeds">
                {segment.embedId ? (
                  <>
                    <VideoEmbed id={segment.embedId} />
                    {segment.extraEmbed && (
                      <VideoEmbed
                        id={segment.extraEmbed.id}
                        label={segment.extraEmbed.label}
                      />
                    )}
                  </>
                ) : (
                  <VideoPlaceholder />
                )}
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
