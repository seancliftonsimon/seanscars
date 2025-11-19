import './Media.css';

interface Video {
    title: string;
    videoId: string;
}

interface VideosByYear {
    [year: number]: Video[];
}

const Media = () => {
    const videosByYear: VideosByYear = {
        2025: [
            { title: "2025 Seanscars Opening Medley", videoId: "AE3kXZzpiMc" },
            { title: "G-O-T-T-O-G-O (Chappell Roan Parody)", videoId: "E45f_kY8YFo" }
        ],
        2024: [
            { title: "You've Never Had Seanscars Like This (2024 Sharemony Opening Song)", videoId: "4WGwyvgxIvE" },
            { title: "Wow is My Butt Sore (Billie Eilish Parody)", videoId: "6KrKB04ct7I" }
        ],
        2023: [
            { title: "Three Star Movies (Whitney Houston Parody)", videoId: "VQOlk5-mpXY" },
            { title: "Nepo Baby (Eartha Kitt Parody)", videoId: "NSthgSNIN5Q" }
        ]
    };

    const years = Object.keys(videosByYear).map(Number).sort((a, b) => b - a);

    const formatTitle = (title: string) => {
        const parenIndex = title.indexOf(' (');
        if (parenIndex === -1) {
            return { main: title, subtitle: null };
        }
        return {
            main: title.substring(0, parenIndex),
            subtitle: title.substring(parenIndex + 1) // includes the opening parenthesis
        };
    };

    return (
        <div className="media-page">
            <div className="media-hero">
                <div className="container">
                    <h1 className="fade-in">Past Songs</h1>
                    <p className="media-subtitle fade-in">
                        Relive the magic through songs from past ceremonies
                    </p>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    {years.map((year) => (
                        <div key={year} className="year-section fade-in">
                            <h2 className="year-header">{year}</h2>
                            <div className="videos-grid">
                                {videosByYear[year].map((video, index) => (
                                    <div key={index} className="video-card">
                                        <div className="video-wrapper">
                                            <iframe
                                                src={`https://www.youtube.com/embed/${video.videoId}`}
                                                title={video.title}
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="video-iframe"
                                            ></iframe>
                                        </div>
                                        <div className="video-info">
                                            {(() => {
                                                const formatted = formatTitle(video.title);
                                                return (
                                                    <h3>
                                                        {formatted.main}
                                                        {formatted.subtitle && (
                                                            <>
                                                                <br />
                                                                <span className="video-subtitle">{formatted.subtitle}</span>
                                                            </>
                                                        )}
                                                    </h3>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Media;
