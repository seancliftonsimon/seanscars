import { Award, Star } from 'lucide-react';
import './HallOfFame.css';

interface Inductee {
    name: string;
    year: number;
    image?: string; // Optional image path - can be added later
}

const inductees: Inductee[] = [
    { name: 'Octavia Spencer', year: 2021 },
    { name: 'Joan Cusack', year: 2022 },
    { name: 'Jamie Lee Curtis', year: 2022 },
    { name: 'Nathan Lane', year: 2023 },
    { name: 'Christine Baranski', year: 2023 },
    { name: 'Agent Dana Scully', year: 2024 },
    { name: 'Dr. Cristina Yang', year: 2024 },
    { name: 'Jodie Foster', year: 2025 },
    { name: 'Kathy Bates', year: 2025 },
];

const HallOfFame = () => {
    // Group inductees by year
    const inducteesByYear = inductees.reduce((acc, inductee) => {
        if (!acc[inductee.year]) {
            acc[inductee.year] = [];
        }
        acc[inductee.year].push(inductee);
        return acc;
    }, {} as Record<number, Inductee[]>);

    const years = Object.keys(inducteesByYear)
        .map(Number)
        .sort((a, b) => a - b);

    return (
        <div className="hall-page">
            <div className="hall-hero">
                <div className="container">
                    <div className="hero-icon">
                        <Star size={64} />
                    </div>
                    <h1 className="fade-in">Hall of Fame</h1>
                    <p className="hall-subtitle fade-in">
                        Honoring LifetiMAchievement in Cinema
                    </p>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    {/* Timeline Section */}
                    <div className="timeline-section">
                        <h2 className="timeline-title">Past Inductees</h2>
                        <div className="timeline">
                            {years.map((year, yearIndex) => (
                                <div key={year} className="timeline-year-group">
                                    <div className="timeline-year-marker">
                                        <div className="year-badge">{year}</div>
                                    </div>
                                    <div className="timeline-inductees">
                                        {inducteesByYear[year].map((inductee, inducteeIndex) => (
                                            <div
                                                key={`${year}-${inducteeIndex}`}
                                                className="timeline-inductee"
                                                style={{
                                                    animationDelay: `${(yearIndex * 0.1) + (inducteeIndex * 0.05)}s`
                                                }}
                                            >
                                                <div className="portrait-frame">
                                                    <div className="portrait-image">
                                                        {inductee.image ? (
                                                            <img src={inductee.image} alt={inductee.name} />
                                                        ) : (
                                                            <>
                                                                <Star size={60} />
                                                                <span className="portrait-placeholder">Photo</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="inductee-name">{inductee.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="honorees-grid">
                        <div
                            className="honoree-card"
                            style={{ animationDelay: '0s' }}
                        >
                            <div className="honoree-year">
                                <Award size={24} />
                                <span>Placeholder Year</span>
                            </div>

                            <div className="honoree-image-placeholder">
                                <Star size={80} />
                                <span className="image-label">Honoree Photo</span>
                            </div>

                            <div className="honoree-content">
                                <h2>Placeholder Name</h2>
                                <p className="honoree-bio">Placeholder bio information</p>

                                <div className="notable-works">
                                    <h3>Notable Works</h3>
                                    <ul>
                                        <li>Placeholder Work 1</li>
                                        <li>Placeholder Work 2</li>
                                        <li>Placeholder Work 3</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HallOfFame;
