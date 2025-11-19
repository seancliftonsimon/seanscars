import { Mail, MapPin, Award } from 'lucide-react';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-grid">
                    <div className="footer-section">
                        <div className="footer-logo">
                            <Award size={32} />
                            <h3>Award Sharemony</h3>
                        </div>
                        <p className="footer-tagline">
                            Where Cinema Meets Celebration
                        </p>
                    </div>

                    <div className="footer-section">
                        <h4>Quick Links</h4>
                        <ul className="footer-links">
                            <li><a href="/">Home</a></li>
                            <li><a href="/info">Event Info</a></li>
                            <li><a href="/history">Past Winners</a></li>
                            <li><a href="/hall-of-fame">Hall of Fame</a></li>
                            <li><a href="/media">Media</a></li>
                            <li><a href="/rsvp">RSVP</a></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>Contact</h4>
                        <div className="footer-contact">
                            <div className="contact-item">
                                <Mail size={18} />
                                <span>info@awardsharemony.com</span>
                            </div>
                            <div className="contact-item">
                                <MapPin size={18} />
                                <span>Washington, DC</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} Award Sharemony. All rights reserved.</p>
                    <p className="footer-credit">Celebrating cinema, one award at a time.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
