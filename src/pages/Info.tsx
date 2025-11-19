import { useState } from 'react';
import { MapPin, Calendar, Clock, Navigation, Award, Users, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import './Info.css';

const Info = () => {
    const [sharemonyExpanded, setSharemonyExpanded] = useState(false);
    const [seanscarsExpanded, setSeanscarsExpanded] = useState(false);

    return (
        <div className="info-page">
            <div className="info-hero">
                <div className="container">
                    <h1 className="fade-in">Event Information</h1>
                    <p className="info-subtitle fade-in">Everything you need to know about The 2026 Award Sharemony</p>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    {/* Schedule */}
                    <div className="info-section slide-in-left">
                        <div className="info-icon">
                            <Calendar size={48} />
                        </div>
                        <div className="info-content">
                            <h2>Schedule</h2>
                            <div className="timeline">
                                <div className="timeline-item">
                                    <Clock size={20} />
                                    <div>
                                        <strong>Sharemony: 7:00 PM - 10:00 PM</strong>
                                        <span>The Theater at the Eaton Hotel</span>
                                        <span className="venue-address">1201 K St NW, Washington, DC 20005</span>
                                    </div>
                                </div>
                                <div className="timeline-item">
                                    <Clock size={20} />
                                    <div>
                                        <strong>Seanity Fair After Party: 10:30 PM - Late</strong>
                                    </div>
                                </div>
                            </div>
                            <a
                                href="https://maps.google.com/?q=1201+K+St+NW+Washington+DC+20005"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                                style={{ marginTop: '1rem' }}
                            >
                                <Navigation size={20} />
                                <span>Get Directions</span>
                            </a>
                        </div>
                    </div>

                    {/* Dress Code & Guidelines */}
                    <div className="info-section slide-in-left">
                        <div className="info-content full-width">
                            <h2>Dress Code & Guidelines</h2>
                            <div className="guidelines-grid">
                                <div className="guideline-card">
                                    <h3>Dress Code</h3>
                                    <p>
                                        Wear something fancy or flashy that makes you feel good -- think red carpet, or just something you'd wear to a nice dinner.
                                    </p>
                                </div>

                                <div className="guideline-card">
                                    <h3>Dining Options</h3>
                                    <p>
                                        <strong>We recommend guests dine before the show.</strong>
                                    </p>
                                    <p>
                                        There are many excellent restaurants near The Theater at the Eaton Hotel. 
                                        We suggest making reservations in advance at nearby establishments 
                                        in the K Street and downtown DC area.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* What is a Sharemony? - Expandable */}
                    <div className="expandable-section slide-in-left">
                        <button 
                            className="expandable-header"
                            onClick={() => setSharemonyExpanded(!sharemonyExpanded)}
                            aria-expanded={sharemonyExpanded}
                        >
                            <div className="expandable-header-content">
                                <div className="expandable-icon">
                                    <Users size={48} />
                                </div>
                                <h2>What is a "Sharemony?"</h2>
                            </div>
                            {sharemonyExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                        </button>
                        {sharemonyExpanded && (
                            <div className="expandable-content">
                                <p>
                                    Besides an incredible example of wordplay, the "Sharemony" features not only the Seanscars, but awards from anyone who'd like to take part! To name just a few from years past:
                                </p>
                                <ul style={{ marginTop: '1rem', marginBottom: '1rem', paddingLeft: '1.5rem', color: 'var(--color-cream)' }}>
                                    <li>The SAMMYs</li>
                                    <li>The Hangoria Awards Presented by the Hancademy</li>
                                    <li>The Carries</li>
                                    <li>The Coleden Globes</li>
                                </ul>
                                <p>
                                    If you'd like to present, think of a punny name for your awards and decide what you'd like to spotlight from 2024. It could be books, video games, celebrity news stories, "Best Bagel I Had All Year," anything you feel moved to share! You can give just one award or ten in a row — it's up to you.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* What are the Seanscars? - Expandable */}
                    <div className="expandable-section slide-in-left">
                        <button 
                            className="expandable-header"
                            onClick={() => setSeanscarsExpanded(!seanscarsExpanded)}
                            aria-expanded={seanscarsExpanded}
                        >
                            <div className="expandable-header-content">
                                <div className="expandable-icon">
                                    <Award size={48} />
                                </div>
                                <h2>What are "The Seanscars?"</h2>
                            </div>
                            {seanscarsExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                        </button>
                        {seanscarsExpanded && (
                            <div className="expandable-content">
                                <p>
                                    The Seanscars are just one show within the Sharemony, but allotted a suspicious fraction of the running time.
                                </p>
                                <p>
                                    The Seancademy gives out some of the typical awards, like Best Picture and Best Director, but the Seanscars are anything but typical. This is an award show where Vanessa Hudgens has been triple-nominated for all three of her roles in The Princess Switch: Switched Again, and where Mechagodzilla has been nominated for Best Supporting Actor. Plus, there are several categories unique to the Seanscars that are awarded each year, including:
                                </p>
                                <ul style={{ marginTop: '1rem', marginBottom: '1rem', paddingLeft: '1.5rem', color: 'var(--color-cream)' }}>
                                    <li>Most Picture</li>
                                    <li>Worst Picture</li>
                                    <li>The "Hoot and Holler" Award for Best Scream at the Screen Moment</li>
                                    <li>The "I'lll Take Your Word For It" Award for Best Performance in a Movie I'll Probably Never See</li>
                                    <li>The "Glenn Close, But No Cigar" Honorable MenSeans</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* How Do I Submit? */}
                    <div className="info-section slide-in-left">
                        <div className="info-icon">
                            <FileText size={48} />
                        </div>
                        <div className="info-content">
                            <h2>How Do I Submit?</h2>
                            <p>
                                If you RSVP you'll receive more details in January, but the general format is a Google Slides deck with nominees together on one slide, followed by a slide announcing your winner. It can be a slide with bullet points (which I can format to match the Seanscars style) or you can go all out with videos, animations, clip art, etc!
                            </p>
                            <p>
                                The sky's the limit, except for the loose five-minute limit to make sure we can include them all!
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Info;
