import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import {
	getAllBallots,
	type Ballot as AdminBallot,
	updateBallotFlagged,
} from "../../services/adminApi";
import { BALLOT_SCHEMA_VERSION, type Ballot } from "../../services/api";
import { db } from "../../services/firebase";
import moviesData from "../../data/movies.json";
import { getCanonicalBestPictureRanks } from "../../utils/bestPictureRanks";
import { v4 as uuidv4 } from "uuid";
import "./Admin.css";

interface RawBallotsProps {
	onAnalyzePresentation: () => void;
}

const REQUIRED_RANK_COUNT = 5;
const MIN_SEEN_COUNT = REQUIRED_RANK_COUNT;
const MAX_SEEN_COUNT = 20;
const MAX_GENERATED_BALLOTS = 200;

const getRandomInt = (min: number, max: number): number => {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

const shuffleArray = <T,>(items: T[]): T[] => {
	const shuffled = [...items];

	for (let i = shuffled.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
};

const RawBallots = ({ onAnalyzePresentation }: RawBallotsProps) => {
	const [ballots, setBallots] = useState<AdminBallot[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [actionSuccess, setActionSuccess] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [numGeneratedBallots, setNumGeneratedBallots] = useState(50);
	const [isGeneratingBallots, setIsGeneratingBallots] = useState(false);
	const [isClearingBallots, setIsClearingBallots] = useState(false);
	const [selectedBallotIds, setSelectedBallotIds] = useState<Set<string>>(
		new Set()
	);
	const [isBulkExcluding, setIsBulkExcluding] = useState(false);
	const [isBulkDeleting, setIsBulkDeleting] = useState(false);
	const itemsPerPage = 20;

	const fetchData = async () => {
		try {
			setLoading(true);
			const data = await getAllBallots();
			setBallots(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load ballots");
		} finally {
			setLoading(false);
		}
	};

	const generateRandomBallot = (index: number): Ballot => {
		const shuffledMovies = shuffleArray(moviesData);
		const maxSeenCount = Math.min(MAX_SEEN_COUNT, moviesData.length);
		const seenCount = getRandomInt(MIN_SEEN_COUNT, maxSeenCount);
		const seenMovies = shuffledMovies.slice(0, seenCount);
		const seenMovieIds = new Set(seenMovies.map((movie) => movie.id));
		const bestPictureRanks = shuffleArray(seenMovies)
			.slice(0, REQUIRED_RANK_COUNT)
			.map((movie) => movie.id);
		const rankByMovieId = new Map(
			bestPictureRanks.map((movieId, rankIndex) => [movieId, rankIndex + 1])
		);

		const movies = moviesData.map((movie) => {
			const seen = seenMovieIds.has(movie.id);

			return {
				id: movie.id,
				title: movie.title,
				seen,
				rank: rankByMovieId.get(movie.id) ?? null,
			};
		});

		return {
			schemaVersion: BALLOT_SCHEMA_VERSION,
			clientId: `sim-${uuidv4()}`,
			ipHash: `sim-ip-${uuidv4()}`,
			voterName: `Simulated Voter ${index + 1}`,
			timestamp: new Date().toISOString(),
			movies,
			bestPictureRanks,
			flagged: false,
		};
	};

	const handleGenerateRandomBallots = async () => {
		const parsedCount = Math.floor(numGeneratedBallots);
		const ballotCount = Number.isFinite(parsedCount) ? parsedCount : 1;
		const safeBallotCount = Math.min(
			MAX_GENERATED_BALLOTS,
			Math.max(1, ballotCount)
		);

		setNumGeneratedBallots(safeBallotCount);
		setActionError(null);
		setActionSuccess(null);
		setIsGeneratingBallots(true);

		try {
			const ballotsToInsert = Array.from(
				{ length: safeBallotCount },
				(_, index) => generateRandomBallot(index)
			);

			await Promise.all(
				ballotsToInsert.map((ballot) => addDoc(collection(db, "ballots"), ballot))
			);

			setActionSuccess(
				`Generated ${safeBallotCount} random ballot${
					safeBallotCount === 1 ? "" : "s"
				}.`
			);
			window.dispatchEvent(new Event("refresh-data"));
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Failed to generate random ballots"
			);
		} finally {
			setIsGeneratingBallots(false);
		}
	};

	const handleClearAllBallots = async () => {
		const firstConfirmation = window.confirm(
			"Are you sure you want to delete ALL voter data?"
		);
		if (!firstConfirmation) {
			return;
		}

		const secondConfirmation = window.confirm(
			"Really sure? This permanently deletes every ballot."
		);
		if (!secondConfirmation) {
			return;
		}

		setActionError(null);
		setActionSuccess(null);
		setIsClearingBallots(true);

		try {
			const ballotsSnapshot = await getDocs(collection(db, "ballots"));
			await Promise.all(ballotsSnapshot.docs.map((docSnapshot) => deleteDoc(docSnapshot.ref)));
			setActionSuccess(
				`Deleted ${ballotsSnapshot.size} ballot${
					ballotsSnapshot.size === 1 ? "" : "s"
				}.`
			);
			window.dispatchEvent(new Event("refresh-data"));
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Failed to clear all voter data"
			);
		} finally {
			setIsClearingBallots(false);
		}
	};

	const handleSelectAllBallots = () => {
		setSelectedBallotIds(new Set(ballots.map((ballot) => ballot.id)));
	};

	const handleDeselectAllBallots = () => {
		setSelectedBallotIds(new Set());
	};

	const handleToggleBallotSelection = (ballotId: string) => {
		setSelectedBallotIds((previousSelection) => {
			const nextSelection = new Set(previousSelection);

			if (nextSelection.has(ballotId)) {
				nextSelection.delete(ballotId);
			} else {
				nextSelection.add(ballotId);
			}

			return nextSelection;
		});
	};

	const handleBulkExcludeSelected = async () => {
		const selectedIds = Array.from(selectedBallotIds);
		if (selectedIds.length === 0) {
			return;
		}

		setActionError(null);
		setActionSuccess(null);
		setIsBulkExcluding(true);

		try {
			await Promise.all(
				selectedIds.map((ballotId) => updateBallotFlagged(ballotId, true))
			);

			setActionSuccess(
				`Excluded ${selectedIds.length} ballot${
					selectedIds.length === 1 ? "" : "s"
				}.`
			);
			setSelectedBallotIds(new Set());
			window.dispatchEvent(new Event("refresh-data"));
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Failed to exclude selected ballots"
			);
		} finally {
			setIsBulkExcluding(false);
		}
	};

	const handleBulkDeleteSelected = async () => {
		const selectedIds = Array.from(selectedBallotIds);
		if (selectedIds.length === 0) {
			return;
		}

		const confirmation = window.confirm(
			`Delete ${selectedIds.length} selected ballot${
				selectedIds.length === 1 ? "" : "s"
			}? This cannot be undone.`
		);

		if (!confirmation) {
			return;
		}

		setActionError(null);
		setActionSuccess(null);
		setIsBulkDeleting(true);

		try {
			await Promise.all(
				selectedIds.map((ballotId) =>
					deleteDoc(doc(db, "ballots", ballotId))
				)
			);

			setActionSuccess(
				`Deleted ${selectedIds.length} ballot${
					selectedIds.length === 1 ? "" : "s"
				}.`
			);
			setSelectedBallotIds(new Set());
			window.dispatchEvent(new Event("refresh-data"));
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Failed to delete selected ballots"
			);
		} finally {
			setIsBulkDeleting(false);
		}
	};

	useEffect(() => {
		fetchData();

		const handleRefresh = () => {
			fetchData();
		};

		window.addEventListener("refresh-data", handleRefresh);
		return () => window.removeEventListener("refresh-data", handleRefresh);
	}, []);

	useEffect(() => {
		setSelectedBallotIds((previousSelection) => {
			if (previousSelection.size === 0) {
				return previousSelection;
			}

			const validBallotIds = new Set(ballots.map((ballot) => ballot.id));
			const nextSelection = new Set(
				Array.from(previousSelection).filter((ballotId) =>
					validBallotIds.has(ballotId)
				)
			);

			return nextSelection.size === previousSelection.size
				? previousSelection
				: nextSelection;
		});
	}, [ballots]);

	const filteredBallots = ballots;
	const totalPages = Math.max(1, Math.ceil(filteredBallots.length / itemsPerPage));
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedBallots = filteredBallots.slice(
		startIndex,
		startIndex + itemsPerPage
	);
	const includedCount = ballots.filter((ballot) => ballot.flagged !== true).length;
	const selectedCount = selectedBallotIds.size;
	const allBallotsSelected =
		ballots.length > 0 &&
		ballots.every((ballot) => selectedBallotIds.has(ballot.id));
	const hasSelectedBallots = selectedCount > 0;
	const isBulkActionRunning = isBulkExcluding || isBulkDeleting;
	const titlesByMovieId = new Map(moviesData.map((movie) => [movie.id, movie.title]));

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	const obfuscateClientId = (clientId: string) => {
		return `${clientId.substring(0, 8)}...`;
	};

	if (loading) {
		return <div className="loading">Loading ballots...</div>;
	}

	if (error) {
		return <div className="error-message">{error}</div>;
	}

	return (
		<div className="admin-section">
			<div className="ballots-header">
				<h2>Raw Ballots</h2>
				<button onClick={onAnalyzePresentation} className="btn btn-primary">
					Analyze / Presentation Mode
				</button>
			</div>

			<div className="ballots-actions">
				<div className="ballots-actions-left">
					<button onClick={fetchData} className="btn btn-secondary">
						Refresh
					</button>
					<button
						onClick={handleSelectAllBallots}
						className="btn btn-secondary"
						disabled={ballots.length === 0 || allBallotsSelected || isBulkActionRunning}
					>
						Select all
					</button>
					<button
						onClick={handleDeselectAllBallots}
						className="btn btn-secondary"
						disabled={!hasSelectedBallots || isBulkActionRunning}
					>
						Deselect all
					</button>
					<button
						onClick={handleBulkExcludeSelected}
						className="btn btn-warning"
						disabled={!hasSelectedBallots || isBulkActionRunning}
					>
						{isBulkExcluding ? "Excluding..." : "Exclude selected"}
					</button>
					<button
						onClick={handleBulkDeleteSelected}
						className="btn btn-danger"
						disabled={!hasSelectedBallots || isBulkActionRunning}
					>
						{isBulkDeleting ? "Deleting..." : "Delete selected"}
					</button>
					<button
						onClick={handleClearAllBallots}
						className="btn btn-danger"
						disabled={isClearingBallots || isBulkActionRunning}
					>
						{isClearingBallots ? "Clearing..." : "Clear All Voter Data"}
					</button>
				</div>
				<div className="ballots-actions-right">
					<button
						onClick={handleGenerateRandomBallots}
						className="btn btn-primary"
						disabled={isGeneratingBallots}
					>
						{isGeneratingBallots ? "Generating..." : "Generate"}
					</button>
					<input
						id="generate-random-ballots"
						type="number"
						min={1}
						max={MAX_GENERATED_BALLOTS}
						step={1}
						value={numGeneratedBallots}
						onChange={(e) => {
							const nextValue = parseInt(e.target.value, 10);
							setNumGeneratedBallots(Number.isFinite(nextValue) ? nextValue : 1);
						}}
						disabled={isGeneratingBallots}
					/>
					<span className="ballots-sample-label">sample ballots</span>
				</div>
			</div>

			<div className="ballots-info">
				<span>
					Included in analysis: <strong>{includedCount}</strong>
				</span>
				<span>
					Showing {paginatedBallots.length} of {filteredBallots.length} ballots
				</span>
				<span>
					<strong>{selectedCount}</strong> selected
				</span>
			</div>

			{actionError && <div className="error-message">{actionError}</div>}
			{actionSuccess && <div className="message success">{actionSuccess}</div>}

			<div className="table-container">
				<table className="results-table raw-ballots-table">
					<thead>
						<tr>
							<th>Select</th>
							<th>Name</th>
							<th>1st</th>
							<th>2nd</th>
							<th>3rd</th>
							<th>4th</th>
							<th>5th</th>
							<th>Seen Count</th>
						</tr>
					</thead>
					<tbody>
						{paginatedBallots.length === 0 && (
							<tr>
								<td colSpan={8}>No ballots found.</td>
							</tr>
						)}
						{paginatedBallots.map((ballot) => {
							const seenCount = ballot.movies.filter((movie) => movie.seen).length;
							const rankedMovieIds = getCanonicalBestPictureRanks(ballot);
							const rankedTitles = Array.from({ length: REQUIRED_RANK_COUNT }, (_, index) => {
								const movieId = rankedMovieIds[index];
								if (!movieId) {
									return "—";
								}

								const fallbackTitle = ballot.movies.find((movie) => movie.id === movieId)?.title;
								return titlesByMovieId.get(movieId) || fallbackTitle || movieId;
							});

							return (
								<tr
									key={ballot.id}
									className={ballot.flagged ? "flagged-row" : undefined}
								>
									<td>
										<input
											type="checkbox"
											checked={selectedBallotIds.has(ballot.id)}
											onChange={() => handleToggleBallotSelection(ballot.id)}
											aria-label={`Select ballot for ${
												ballot.voterName || obfuscateClientId(ballot.clientId)
											}`}
											disabled={isBulkActionRunning}
										/>
									</td>
									<td className="movie-title-cell">
										{ballot.voterName || obfuscateClientId(ballot.clientId)}
										{ballot.flagged && (
											<span className="ballot-excluded-label">Excluded</span>
										)}
									</td>
									<td>{rankedTitles[0]}</td>
									<td>{rankedTitles[1]}</td>
									<td>{rankedTitles[2]}</td>
									<td>{rankedTitles[3]}</td>
									<td>{rankedTitles[4]}</td>
									<td>{seenCount}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="pagination">
					<button
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						disabled={currentPage === 1}
						className="btn btn-secondary"
					>
						Previous
					</button>
					<span className="page-info">
						Page {currentPage} of {totalPages}
					</span>
					<button
						onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						disabled={currentPage === totalPages}
						className="btn btn-secondary"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
};

export default RawBallots;
