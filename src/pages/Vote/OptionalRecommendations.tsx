import { useMemo, useRef, type PointerEvent } from "react";
import type { Movie } from "./Vote";
import "./Vote.css";

export interface OptionalRecommendationQuestion {
	key: string;
	prompt: string;
	emphasis: string;
}

interface OptionalRecommendationsProps {
	questions: OptionalRecommendationQuestion[];
	currentQuestionIndex: number;
	seenMovies: Movie[];
	selectedMovieId: string | null;
	canContinue: boolean;
	isSaving: boolean;
	error: string | null;
	onSelectMovie: (movieId: string) => void;
	onBack: () => void;
	onContinue: () => void;
	onFinishWithoutSeen: () => void;
	continueLabel?: string;
	showQuestionCount?: boolean;
}

const TAP_MOVE_THRESHOLD_PX = 10;

const OptionalRecommendations = ({
	questions,
	currentQuestionIndex,
	seenMovies,
	selectedMovieId,
	canContinue,
	isSaving,
	error,
	onSelectMovie,
	onBack,
	onContinue,
	onFinishWithoutSeen,
	continueLabel,
	showQuestionCount = true,
}: OptionalRecommendationsProps) => {
	const pointerStateRef = useRef<
		Record<string, { pointerId: number; startX: number; startY: number; moved: boolean }>
	>({});
	const activeQuestion = questions[currentQuestionIndex];
	const isBusy = isSaving;

	const orderedSeenMovies = useMemo(
		() =>
			[...seenMovies].sort((left, right) => {
				const titleComparison = left.title.localeCompare(right.title);
				if (titleComparison !== 0) {
					return titleComparison;
				}
				return left.id.localeCompare(right.id);
			}),
		[seenMovies]
	);

	if (!activeQuestion) {
		return null;
	}

	const handleMoviePointerDown = (
		movieId: string,
		event: PointerEvent<HTMLButtonElement>
	) => {
		if (isBusy) {
			return;
		}

		pointerStateRef.current[movieId] = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			moved: false,
		};
	};

	const handleMoviePointerMove = (
		movieId: string,
		event: PointerEvent<HTMLButtonElement>
	) => {
		const pointerState = pointerStateRef.current[movieId];
		if (!pointerState || pointerState.pointerId !== event.pointerId || pointerState.moved) {
			return;
		}

		const moveX = Math.abs(event.clientX - pointerState.startX);
		const moveY = Math.abs(event.clientY - pointerState.startY);

		if (moveX > TAP_MOVE_THRESHOLD_PX || moveY > TAP_MOVE_THRESHOLD_PX) {
			pointerState.moved = true;
		}
	};

	const handleMoviePointerEnd = (
		movieId: string,
		event: PointerEvent<HTMLButtonElement>
	) => {
		const pointerState = pointerStateRef.current[movieId];
		if (!pointerState || pointerState.pointerId !== event.pointerId) {
			return;
		}

		if (!pointerState.moved && !isBusy) {
			onSelectMovie(movieId);
		}

		delete pointerStateRef.current[movieId];
	};

	const handleMoviePointerCancel = (
		movieId: string,
		event: PointerEvent<HTMLButtonElement>
	) => {
		const pointerState = pointerStateRef.current[movieId];
		if (!pointerState || pointerState.pointerId !== event.pointerId) {
			return;
		}

		delete pointerStateRef.current[movieId];
	};

	const renderPrompt = () => {
		const emphasis = activeQuestion.emphasis.trim();
		if (!emphasis) {
			return activeQuestion.prompt;
		}

		const promptIndex = activeQuestion.prompt
			.toLocaleLowerCase()
			.indexOf(emphasis.toLocaleLowerCase());
		if (promptIndex < 0) {
			return activeQuestion.prompt;
		}

		const promptStart = activeQuestion.prompt.slice(0, promptIndex);
		const promptMiddle = activeQuestion.prompt.slice(
			promptIndex,
			promptIndex + emphasis.length
		);
		const promptEnd = activeQuestion.prompt.slice(promptIndex + emphasis.length);

		return (
			<>
				{promptStart}
				<span className="optional-recommendation-emphasis">{promptMiddle}</span>
				{promptEnd}
			</>
		);
	};

	return (
		<div className="vote-screen optional-recommendations-screen">
			<div className="vote-header">
				<h2>{renderPrompt()}</h2>
			</div>

			<div className="vote-content">
				{error && <div className="error-message">{error}</div>}

				{orderedSeenMovies.length === 0 ? (
					<div className="optional-empty-state">
						<p>No seen movies recorded.</p>
						<button
							type="button"
							className="btn btn-primary"
							onClick={onFinishWithoutSeen}
							disabled={isBusy}
						>
							{isBusy ? "Saving..." : "Finish"}
						</button>
					</div>
				) : (
					<>
						<div className="optional-recommendations-list">
							{orderedSeenMovies.map((movie) => {
								const isSelected = selectedMovieId === movie.id;

								return (
									<button
										type="button"
										key={movie.id}
										className={`optional-recommendation-item ${
											isSelected ? "selected" : ""
										}`}
										onPointerDown={(event) =>
											handleMoviePointerDown(movie.id, event)
										}
										onPointerMove={(event) =>
											handleMoviePointerMove(movie.id, event)
										}
										onPointerUp={(event) =>
											handleMoviePointerEnd(movie.id, event)
										}
										onPointerCancel={(event) =>
											handleMoviePointerCancel(movie.id, event)
										}
									>
										<span className="optional-recommendation-title">
											{movie.title}
										</span>
										{isSelected && (
											<span className="optional-recommendation-badge">Selected</span>
										)}
									</button>
								);
							})}
						</div>

						<div className="vote-footer optional-recommendations-footer">
							<button
								type="button"
								onClick={onBack}
								className="btn btn-secondary"
								disabled={isBusy}
							>
								Back
							</button>
							{showQuestionCount && (
								<div className="rank-count optional-recommendation-count">
									Question {currentQuestionIndex + 1} of {questions.length}
								</div>
							)}
							<button
								type="button"
								onClick={onContinue}
								className="btn btn-primary"
								disabled={!canContinue || isBusy}
							>
								{isBusy
									? "Saving..."
									: continueLabel ||
										(currentQuestionIndex === questions.length - 1
											? "Finish"
											: "Continue")}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default OptionalRecommendations;
