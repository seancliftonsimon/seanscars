import { Menu, X, Award } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
	const [isOpen, setIsOpen] = useState(false);
	const location = useLocation();

	const navLinks = [
		{ path: "/", label: "Home" },
		{ path: "/info", label: "Event Info" },
		{ path: "/media", label: "Past Songs" },
		{ path: "/hall-of-fame", label: "Hall of Fame" },
		{ path: "/rsvp", label: "RSVP" },
		{ path: "/vote", label: "Vote" },
	];

	const isActive = (path: string) => location.pathname === path;

	return (
		<nav className="navbar">
			<div className="navbar-container">
				<Link to="/" className="navbar-logo">
					<Award className="logo-icon" />
					<span className="logo-text">Award Sharemony</span>
				</Link>

				<button
					className="navbar-toggle"
					onClick={() => setIsOpen(!isOpen)}
					aria-label="Toggle menu"
				>
					{isOpen ? <X size={28} /> : <Menu size={28} />}
				</button>

				<ul className={`navbar-menu ${isOpen ? "active" : ""}`}>
					{navLinks.map((link) => (
						<li key={link.path} className="navbar-item">
							<Link
								to={link.path}
								className={`navbar-link ${isActive(link.path) ? "active" : ""}`}
								onClick={() => setIsOpen(false)}
							>
								{link.label}
							</Link>
						</li>
					))}
				</ul>
			</div>
		</nav>
	);
};

export default Navbar;
