import { useEffect, useState } from "react";
import { getAllBallots, type Ballot } from "../../services/adminApi";
import "./Admin.css";

const RawBallots = () => {
	const [ballots, setBallots] = useState<Ballot[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [expandedBallot, setExpandedBallot] = useState<string | null>(null);
	const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
	const itemsPerPage = 20;

	const fetchData = async () => {
		try {
			setLoading(true);
			const data = await getAllBallots();
			setBallots(data);
			setError(null);
		} catch (err) {
			if (err instanceof Error && err.message === "Unauthorized") {
				sessionStorage.removeItem("admin_token");
				window.location.href = "/admin/login";
			} else {
				setError(err instanceof Error ? err.message : "Failed to load ballots");
			}
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

	const filteredBallots = showFlaggedOnly
		? ballots.filter((b) => b.flagged)
		: ballots;

	const totalPages = Math.ceil(filteredBallots.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedBallots = filteredBallots.slice(
		startIndex,
		startIndex + itemsPerPage
	);

	const obfuscateClientId = (clientId: string) => {
		return clientId.substring(0, 8) + "...";
	};

	const formatDate = (timestamp: string) => {
		return new Date(timestamp).toLocaleString();
	};

	const getRankedMovies = (ballot: Ballot) => {
		return ballot.movies
			.filter((m) => m.seen && m.rank)
			.sort((a, b) => (a.rank || 0) - (b.rank || 0));
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
			</div>

			<div className="ballots-info">
				Showing {paginatedBallots.length} of {filteredBallots.length} ballots
			</div>

			<div className="ballots-list">
				{paginatedBallots.map((ballot) => {
					const isExpanded = expandedBallot === ballot.id;
					const rankedMovies = getRankedMovies(ballot);
					const seenCount = ballot.movies.filter((m) => m.seen).length;

					return (
						<div
							key={ballot.id}
							className={`ballot-item ${ballot.flagged ? "flagged" : ""}`}
						>
							<div
								className="ballot-header"
								onClick={() => setExpandedBallot(isExpanded ? null : ballot.id)}
							>
								<div className="ballot-info">
									<div className="ballot-id">
										{ballot.voterName ? (
											<strong>{ballot.voterName}</strong>
										) : (
											obfuscateClientId(ballot.clientId)
										)}
									</div>
									<div className="ballot-date">
										{formatDate(ballot.timestamp)}
									</div>
									{ballot.flagged && (
										<span className="flag-badge">Flagged</span>
									)}
								</div>
								<div className="ballot-summary">
									{seenCount} seen, {rankedMovies.length} ranked
								</div>
								<div className="expand-icon">{isExpanded ? "▼" : "▶"}</div>
							</div>

							{isExpanded && (
								<div className="ballot-details">
									{ballot.voterName && (
										<div className="detail-row">
											<strong>Voter Name:</strong> {ballot.voterName}
										</div>
									)}
									<div className="detail-row">
										<strong>Client ID:</strong> {ballot.clientId}
									</div>
									<div className="detail-row">
										<strong>Timestamp:</strong> {formatDate(ballot.timestamp)}
									</div>
									{ballot.ipHash && (
										<div className="detail-row">
											<strong>IP Hash:</strong> {ballot.ipHash}
										</div>
									)}
									<div className="detail-row">
										<strong>Seen Movies:</strong> {seenCount}
									</div>
									{rankedMovies.length > 0 && (
										<div className="detail-row">
											<strong>Rankings:</strong>
											<ol className="rankings-list">
												{rankedMovies.map((movie) => (
													<li key={movie.id}>
														#{movie.rank}: {movie.id}
													</li>
												))}
											</ol>
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}
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

			<button
				onClick={fetchData}
				className="btn btn-secondary"
				style={{ marginTop: "1rem" }}
			>
				Refresh
			</button>
		</div>
	);
};

export default RawBallots;
