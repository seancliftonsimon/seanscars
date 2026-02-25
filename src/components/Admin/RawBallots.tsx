import { useEffect, useState } from "react";
import {
	getAllBallots,
	updateBallotFlagged,
	type Ballot,
} from "../../services/adminApi";
import { getCanonicalBestPictureRanks } from "../../utils/bestPictureRanks";
import "./Admin.css";

interface RawBallotsProps {
	onAnalyzePresentation: () => void;
}

const REQUIRED_RANK_COUNT = 5;

const RawBallots = ({ onAnalyzePresentation }: RawBallotsProps) => {
	const [ballots, setBallots] = useState<Ballot[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
	const [pendingFlags, setPendingFlags] = useState<Record<string, boolean>>({});
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

	useEffect(() => {
		fetchData();

		const handleRefresh = () => {
			fetchData();
		};

		window.addEventListener("refresh-data", handleRefresh);
		return () => window.removeEventListener("refresh-data", handleRefresh);
	}, []);

	const handleFlaggedToggle = async (ballotId: string, flagged: boolean) => {
		const previousFlagged =
			ballots.find((ballot) => ballot.id === ballotId)?.flagged === true;

		setActionError(null);
		setPendingFlags((prev) => ({ ...prev, [ballotId]: true }));
		setBallots((prev) =>
			prev.map((ballot) =>
				ballot.id === ballotId ? { ...ballot, flagged } : ballot
			)
		);

		try {
			await updateBallotFlagged(ballotId, flagged);
			window.dispatchEvent(new Event("refresh-data"));
		} catch (err) {
			setBallots((prev) =>
				prev.map((ballot) =>
					ballot.id === ballotId
						? { ...ballot, flagged: previousFlagged }
						: ballot
				)
			);
			setActionError(
				err instanceof Error ? err.message : "Failed to update ballot flag"
			);
		} finally {
			setPendingFlags((prev) => {
				const next = { ...prev };
				delete next[ballotId];
				return next;
			});
		}
	};

	const filteredBallots = showFlaggedOnly
		? ballots.filter((b) => b.flagged === true)
		: ballots;

	const totalPages = Math.max(1, Math.ceil(filteredBallots.length / itemsPerPage));
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedBallots = filteredBallots.slice(
		startIndex,
		startIndex + itemsPerPage
	);
	const excludedCount = ballots.filter((ballot) => ballot.flagged === true).length;
	const includedCount = ballots.length - excludedCount;

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	const obfuscateClientId = (clientId: string) => {
		return `${clientId.substring(0, 8)}...`;
	};

	const formatDate = (timestamp: string) => {
		return new Date(timestamp).toLocaleString();
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
				<label className="checkbox-label">
					<input
						type="checkbox"
						checked={showFlaggedOnly}
						onChange={(e) => {
							setShowFlaggedOnly(e.target.checked);
							setCurrentPage(1);
						}}
					/>
					Show flagged only
				</label>
				<button onClick={fetchData} className="btn btn-secondary">
					Refresh
				</button>
			</div>

			<div className="ballots-info">
				<span>
					Included in analysis: <strong>{includedCount}</strong>
				</span>
				<span>
					Excluded: <strong>{excludedCount}</strong>
				</span>
				<span>
					Showing {paginatedBallots.length} of {filteredBallots.length} ballots
				</span>
			</div>

			{actionError && <div className="error-message">{actionError}</div>}

			<div className="table-container">
				<table className="results-table raw-ballots-table">
					<thead>
						<tr>
							<th>Voter</th>
							<th>Submitted</th>
							<th>Seen Count</th>
							<th>Ranking Valid</th>
							<th>Status</th>
							<th>Exclude from Analysis</th>
						</tr>
					</thead>
					<tbody>
						{paginatedBallots.length === 0 && (
							<tr>
								<td colSpan={6}>No ballots found.</td>
							</tr>
						)}
						{paginatedBallots.map((ballot) => {
							const seenCount = ballot.movies.filter((movie) => movie.seen).length;
							const rankedCount = getCanonicalBestPictureRanks(ballot).length;
							const isRankingValid = rankedCount === REQUIRED_RANK_COUNT;
							const isExcluded = ballot.flagged === true;
							const isPending = pendingFlags[ballot.id] === true;

							return (
								<tr key={ballot.id} className={isExcluded ? "flagged-row" : ""}>
									<td className="movie-title-cell">
										{ballot.voterName || obfuscateClientId(ballot.clientId)}
									</td>
									<td>{formatDate(ballot.timestamp)}</td>
									<td>{seenCount}</td>
									<td>
										{isRankingValid
											? "Valid"
											: `Invalid (${rankedCount}/${REQUIRED_RANK_COUNT})`}
									</td>
									<td>{isExcluded ? "Excluded" : "Included"}</td>
									<td>
										<div className="flag-toggle-cell">
											<label className="checkbox-label">
												<input
													type="checkbox"
													checked={isExcluded}
													disabled={isPending}
													onChange={(e) =>
														handleFlaggedToggle(ballot.id, e.target.checked)
													}
												/>
												Exclude
											</label>
											{isPending && (
												<span className="flag-save-status">Saving...</span>
											)}
										</div>
									</td>
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
