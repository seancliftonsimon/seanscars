import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Welcome from "./Welcome";
import MarkSeen from "./MarkSeen";
import ChooseFavorites from "./ChooseFavorites";
import RankFavorites from "./RankFavorites";
import ExtraQuestions from "./ExtraQuestions";
import moviesData from "../../data/movies.json";
import { getOrCreateClientId } from "../../utils/voting";
import {
	submitBallot,
	hashIP,
	type Ballot,
	type BallotMovie,
} from "../../services/api";
import "./Vote.css";

export interface Movie {
	id: string;
	title: string;
}

const Vote = () => {
	const navigate = useNavigate();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [password, setPassword] = useState("");
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [screen, setScreen] = useState(0);
	const [voterName, setVoterName] = useState("");
	const [movies] = useState<Movie[]>(moviesData);
	const [seenMovies, setSeenMovies] = useState<Set<string>>(new Set());
	const [wantToSeeMovies, setWantToSeeMovies] = useState<Set<string>>(
		new Set()
	);
	const [favoriteMovies, setFavoriteMovies] = useState<Set<string>>(new Set());
	const [rankedMovies, setRankedMovies] = useState<Map<string, number>>(
		new Map()
	);
	const [extraQuestions, setExtraQuestions] = useState<{
		underSeenRec?: string;
		favoriteScary?: string;
		funniest?: string;
		bestTimeAtMovies?: string;
	}>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Initialize client ID on mount
		getOrCreateClientId();
	}, []);

	const handlePasswordSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (password.toUpperCase() === "HOST") {
			setIsAuthenticated(true);
			setPasswordError(null);
		} else {
			setPasswordError("Incorrect password. Please try again.");
			setPassword("");
		}
	};

	const handleMarkSeen = (movieId: string) => {
		const newSeen = new Set(seenMovies);
		if (newSeen.has(movieId)) {
			newSeen.delete(movieId);
			// Also remove from favorites if it was there
			const newFavorites = new Set(favoriteMovies);
			newFavorites.delete(movieId);
			setFavoriteMovies(newFavorites);
			// Remove from rankings
			const newRanked = new Map(rankedMovies);
			newRanked.delete(movieId);
			setRankedMovies(newRanked);
		} else {
			newSeen.add(movieId);
		}
		setSeenMovies(newSeen);
	};

	const handleMarkSeenBatch = (
		movieIds: string[],
		action: "add" | "remove"
	) => {
		const newSeen = new Set(seenMovies);

		if (action === "add") {
			movieIds.forEach((id) => newSeen.add(id));
			setSeenMovies(newSeen);
		} else {
			// Remove from seen, favorites, and rankings
			const newFavorites = new Set(favoriteMovies);
			const newRanked = new Map(rankedMovies);

			movieIds.forEach((id) => {
				newSeen.delete(id);
				newFavorites.delete(id);
				newRanked.delete(id);
			});

			setSeenMovies(newSeen);
			setFavoriteMovies(newFavorites);
			setRankedMovies(newRanked);
		}
	};

	const handleWantToSee = (movieId: string) => {
		const newWantToSee = new Set(wantToSeeMovies);
		if (newWantToSee.has(movieId)) {
			newWantToSee.delete(movieId);
		} else {
			newWantToSee.add(movieId);
		}
		setWantToSeeMovies(newWantToSee);
	};

	const handleToggleFavorite = (movieId: string) => {
		const newFavorites = new Set(favoriteMovies);
		if (newFavorites.has(movieId)) {
			newFavorites.delete(movieId);
			// Remove from rankings
			const newRanked = new Map(rankedMovies);
			newRanked.delete(movieId);
			setRankedMovies(newRanked);
		} else {
			if (newFavorites.size < 5) {
				newFavorites.add(movieId);
			}
		}
		setFavoriteMovies(newFavorites);
	};

	const handleRankChange = (movieId: string, rank: number | null) => {
		const newRanked = new Map(rankedMovies);

		// Remove any existing rank for this movie
		newRanked.delete(movieId);

		// Remove the rank from any other movie that had it
		if (rank !== null) {
			for (const [id, r] of newRanked.entries()) {
				if (r === rank) {
					newRanked.delete(id);
					break;
				}
			}
			newRanked.set(movieId, rank);
		}

		setRankedMovies(newRanked);
	};

	const handleUpdateRankings = (newRanked: Map<string, number>) => {
		setRankedMovies(newRanked);
	};

	const handleSubmit = async () => {
		setSubmitting(true);
		setError(null);

		try {
			const clientId = getOrCreateClientId();
			const ipHash = hashIP();

			// Build ballot movies array
			const ballotMovies: BallotMovie[] = movies.map((movie) => ({
				id: movie.id,
				seen: seenMovies.has(movie.id),
				wantToSee: wantToSeeMovies.has(movie.id),
				rank: rankedMovies.get(movie.id) || null,
				underSeenRec: extraQuestions.underSeenRec === movie.id,
				favoriteScary: extraQuestions.favoriteScary === movie.id,
				funniest: extraQuestions.funniest === movie.id,
				bestTimeAtMovies: extraQuestions.bestTimeAtMovies === movie.id,
			}));

			const ballot: Ballot = {
				clientId,
				timestamp: new Date().toISOString(),
				ipHash,
				voterName: voterName.trim(),
				movies: ballotMovies,
				flagged: false,
			};

			await submitBallot(ballot);
			setScreen(5); // Success screen
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit ballot");
		} finally {
			setSubmitting(false);
		}
	};

	const handleNext = () => {
		if (screen === 0) {
			setScreen(1);
		} else if (screen === 1) {
			if (seenMovies.size > 0) {
				setScreen(2);
			}
		} else if (screen === 2) {
			if (favoriteMovies.size > 0 && favoriteMovies.size <= 5) {
				setScreen(3);
			}
		}
	};

	const handleBack = () => {
		if (screen > 0) {
			setScreen(screen - 1);
		}
	};

	// Show password screen if not authenticated
	if (!isAuthenticated) {
		return (
			<div className="vote-container">
				<div className="vote-screen welcome-screen">
					<div className="vote-content">
						<h1>Voting Access</h1>
						<div
							style={{
								backgroundColor: "#fff3cd",
								border: "1px solid #ffc107",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "2rem",
								textAlign: "center",
								maxWidth: "400px",
								margin: "0 auto 2rem auto",
							}}
						>
							<p
								style={{
									margin: 0,
									fontWeight: "bold",
									color: "#856404",
									fontSize: "1.1rem",
								}}
							>
								Currently Under Construction
							</p>
							<p
								style={{
									margin: "0.5rem 0 0 0",
									color: "#856404",
								}}
							>
								We'll be ready in time for the ceremony.
							</p>
						</div>
						<p className="welcome-description">
							Please enter the password to access the voting section.
						</p>
						<form
							onSubmit={handlePasswordSubmit}
							style={{ width: "100%", maxWidth: "400px", margin: "0 auto" }}
						>
							<input
								type="password"
								value={password}
								onChange={(e) => {
									setPassword(e.target.value);
									setPasswordError(null);
								}}
								placeholder="Enter password"
								className="search-input"
								style={{ marginBottom: "1rem", textAlign: "center" }}
								autoFocus
							/>
							{passwordError && (
								<div className="error-message" style={{ marginBottom: "1rem" }}>
									{passwordError}
								</div>
							)}
							<button
								type="submit"
								className="btn btn-primary btn-large"
								style={{ width: "100%" }}
							>
								Enter
							</button>
						</form>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="vote-container">
			{screen === 0 && (
				<Welcome
					voterName={voterName}
					onNameChange={setVoterName}
					onStart={handleNext}
				/>
			)}
			{screen === 1 && (
				<MarkSeen
					movies={movies}
					seenMovies={seenMovies}
					wantToSeeMovies={wantToSeeMovies}
					onMarkSeen={handleMarkSeen}
					onMarkSeenBatch={handleMarkSeenBatch}
					onWantToSee={handleWantToSee}
					onNext={handleNext}
					onBack={handleBack}
				/>
			)}
			{screen === 2 && (
				<ChooseFavorites
					movies={movies.filter((m) => seenMovies.has(m.id))}
					favoriteMovies={favoriteMovies}
					onToggleFavorite={handleToggleFavorite}
					onNext={handleNext}
					onBack={handleBack}
				/>
			)}
			{screen === 3 && (
				<RankFavorites
					movies={movies.filter((m) => favoriteMovies.has(m.id))}
					rankedMovies={rankedMovies}
					onRankChange={handleRankChange}
					onUpdateRankings={handleUpdateRankings}
					onNext={() => setScreen(4)}
					onBack={handleBack}
				/>
			)}
			{screen === 4 && (
				<ExtraQuestions
					movies={movies.filter((m) => seenMovies.has(m.id))}
					extraQuestions={extraQuestions}
					onExtraQuestionChange={(question, movieId) => {
						setExtraQuestions((prev) => ({ ...prev, [question]: movieId }));
					}}
					onSubmit={handleSubmit}
					onBack={handleBack}
					submitting={submitting}
					error={error}
				/>
			)}
			{screen === 5 && (
				<div className="vote-success">
					<h1>Thank You!</h1>
					<p>Your vote has been submitted successfully.</p>
					<button onClick={() => navigate("/")} className="btn btn-primary">
						Return to Home
					</button>
				</div>
			)}
		</div>
	);
};

export default Vote;
