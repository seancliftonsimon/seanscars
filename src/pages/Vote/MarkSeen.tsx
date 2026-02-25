import { useEffect, useMemo, useRef, useState } from "react";
import type { Movie } from "./Vote";
import "./Vote.css";

interface MarkSeenProps {
	movies: Movie[];
	seenMovies: Set<string>;
	onMarkSeen: (movieId: string) => void;
	onNext: () => void;
	onBack: () => void;
	isLoadingOrder: boolean;
}

const MOVIES_PER_PAGE = 11;

const MarkSeen = ({
	movies,
	seenMovies,
	onMarkSeen,
	onNext,
	onBack,
	isLoadingOrder,
}: MarkSeenProps) => {
	const [currentPage, setCurrentPage] = useState(0);
	const [zeroNewSelectionPageStreak, setZeroNewSelectionPageStreak] = useState(0);
	const [showEarlyFinishPrompt, setShowEarlyFinishPrompt] = useState(false);
	const latestSeenMoviesRef = useRef<Set<string>>(new Set(seenMovies));
	const pageEntrySeenMoviesRef = useRef<Set<string>>(new Set(seenMovies));

	const totalPages = Math.max(1, Math.ceil(movies.length / MOVIES_PER_PAGE));
	const effectivePage = Math.min(currentPage, totalPages - 1);

	useEffect(() => {
		latestSeenMoviesRef.current = new Set(seenMovies);
	}, [seenMovies]);

	useEffect(() => {
		pageEntrySeenMoviesRef.current = new Set(latestSeenMoviesRef.current);
	}, [effectivePage]);

	const paginatedMovies = useMemo(() => {
		const start = effectivePage * MOVIES_PER_PAGE;
		return movies.slice(start, start + MOVIES_PER_PAGE);
	}, [effectivePage, movies]);

	const pageHasSeenSelections = paginatedMovies.some((movie) =>
		seenMovies.has(movie.id)
	);
	const hasPreviousPage = effectivePage > 0;
	const hasMorePages = effectivePage < totalPages - 1;

	const getNewSelectionsThisPage = () =>
		paginatedMovies.filter(
			(movie) =>
				seenMovies.has(movie.id) &&
				!pageEntrySeenMoviesRef.current.has(movie.id)
		).length;

	const handleBackClick = () => {
		setShowEarlyFinishPrompt(false);
		setZeroNewSelectionPageStreak(0);
		if (hasPreviousPage) {
			setCurrentPage(effectivePage - 1);
			return;
		}

		onBack();
	};

	const goForward = () => {
		if (hasMorePages) {
			setCurrentPage(effectivePage + 1);
			return;
		}

		onNext();
	};

	const handleNextClick = () => {
		const newSelectionsThisPage = getNewSelectionsThisPage();
		const nextZeroStreak =
			newSelectionsThisPage === 0 ? zeroNewSelectionPageStreak + 1 : 0;
		const shouldShowEarlyFinishPrompt = nextZeroStreak >= 2;

		setZeroNewSelectionPageStreak(nextZeroStreak);
		if (shouldShowEarlyFinishPrompt) {
			setShowEarlyFinishPrompt(true);
			return;
		}

		setShowEarlyFinishPrompt(false);
		goForward();
	};

	const handleKeepGoingClick = () => {
		setShowEarlyFinishPrompt(false);
		setZeroNewSelectionPageStreak(0);
		goForward();
	};

	return (
		<div className="vote-screen mark-seen-screen">
			<div className="vote-header">
				<h2>Tap every movie you've seen.</h2>
				<div className="seen-count">
					Seen: {seenMovies.size} / {movies.length}
				</div>
			</div>

			<div className="vote-content">
				<div className="mark-seen-progress">Page {effectivePage + 1} of {totalPages}</div>

				{isLoadingOrder ? (
					<div className="mark-seen-loading">Loading movies...</div>
				) : (
					<div className="mark-seen-list">
						{paginatedMovies.map((movie) => {
							const isSeen = seenMovies.has(movie.id);

							return (
								<button
									type="button"
									key={movie.id}
									className={`mark-seen-item ${isSeen ? "seen" : ""}`}
									onClick={() => onMarkSeen(movie.id)}
								>
									<span className={`mark-seen-checkbox ${isSeen ? "checked" : ""}`}>
										{isSeen ? "✓" : ""}
									</span>
									<span className="mark-seen-title">{movie.title}</span>
								</button>
							);
						})}
					</div>
				)}

				<div className="vote-footer mark-seen-footer">
					<button
						type="button"
						onClick={handleBackClick}
						className="btn btn-secondary"
						disabled={isLoadingOrder}
					>
						Back
					</button>
					<div
						className={`mark-seen-forward-actions ${
							showEarlyFinishPrompt ? "prompt-actions" : "single-action"
						}`}
					>
						{showEarlyFinishPrompt ? (
							<>
								<button
									type="button"
									onClick={handleKeepGoingClick}
									className="btn btn-secondary"
									disabled={isLoadingOrder}
								>
									Keep going
								</button>
								<button
									type="button"
									onClick={onNext}
									className="btn btn-primary"
									disabled={isLoadingOrder}
								>
									That's probably all I've seen
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={handleNextClick}
								className="btn btn-primary"
								disabled={isLoadingOrder}
							>
								{pageHasSeenSelections ? "Next" : "Next (none of these)"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default MarkSeen;
