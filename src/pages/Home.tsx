import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Clock } from "lucide-react";
import "./Home.css";

const Home = () => {
	const [curtainOpen, setCurtainOpen] = useState(false);

	useEffect(() => {
		setTimeout(() => setCurtainOpen(true), 300);
	}, []);

	return (
		<div className="home">
			{/* Hero Section with Curtain Effect */}
			<section className={`hero ${curtainOpen ? "open" : ""}`}>
				<div className="curtain-left"></div>
				<div className="curtain-right"></div>

				<div className="hero-content">
					<h1 className="hero-title">
						The <span className="gold-text">2026 Award</span> Sharemony
					</h1>

					<p className="hero-subtitle">Where Cinema Meets Celebration</p>

					<div className="hero-details">
						<div className="detail-item">
							<Calendar size={20} />
							<span>Saturday March 7, 2026</span>
						</div>
						<div className="detail-item">
							<MapPin size={20} />
							<span>The Eaton Hotel Theater, Washington, DC</span>
						</div>
						<div className="detail-item">
							<Clock size={20} />
							<span>7 PM - 10 PM</span>
						</div>
					</div>

					<div className="hero-actions">
						<Link to="/rsvp" className="btn btn-primary">
							Reserve Your Seat
						</Link>
						<Link to="/info" className="btn">
							Learn More
						</Link>
					</div>
				</div>

				<div className="hero-overlay"></div>
			</section>

			{/* Combined About and CTA Section */}
			<section className="section combined-section">
				<div className="container">
					<div className="combined-content">
						{/* About Section */}
						<div className="about-text fade-in">
							<h2>The Sharemony</h2>
							<p>
								Join us for an unforgettable evening celebrating the art of
								cinema. The Sharemony features not only the Seanscars, but awards from anyone who'd like to take part!
							</p>
							<p>
								This unique awards ceremony brings together film enthusiasts to share their favorite
								films, celebrate the magic of movies, and present their own creative awards in a night of
								recognition and celebration.
							</p>
						</div>

						{/* CTA Section */}
						<div className="cta-content text-center">
							<h2 className="gold-text">Don't Miss Out</h2>
							<p className="cta-text">
								Secure your place at the most anticipated film celebration of the
								year
							</p>
							<Link to="/rsvp" className="btn btn-primary btn-large">
								RSVP Now
							</Link>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
};

export default Home;
