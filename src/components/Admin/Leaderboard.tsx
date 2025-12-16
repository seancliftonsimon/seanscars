import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "../../services/adminApi";
import "./Admin.css";

const Leaderboard = () => {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = async () => {
		try {
			setLoading(true);
			const data = await getLeaderboard();
			setLeaderboard(data);
			setError(null);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load leaderboard"
			);
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

	if (loading) {
		return <div className="loading">Loading leaderboard...</div>;
	}

	if (error) {
		return <div className="error-message">{error}</div>;
	}

	if (leaderboard.length === 0) {
		return <div>No voters yet</div>;
	}

	// Calculate stats
	const totalVoters = leaderboard.length;
	const totalMoviesSeen = leaderboard.reduce(
		(sum, entry) => sum + entry.moviesSeen,
		0
	);
	const avgMoviesSeen =
		totalVoters > 0 ? (totalMoviesSeen / totalVoters).toFixed(1) : "0";

	// Find top and bottom
	const mostSeen = leaderboard[0];
	const leastSeen = leaderboard[leaderboard.length - 1];

	return (
		<div className="admin-section">
			<h2>Voter Leaderboard</h2>

			{/* Stats Overview */}
			<div className="overview-grid" style={{ marginBottom: "2rem" }}>
				<div className="stat-card">
					<div className="stat-label">Total Voters</div>
					<div className="stat-value">{totalVoters}</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">Average Movies Seen</div>
					<div className="stat-value">{avgMoviesSeen}</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">Most Movies Seen</div>
					<div className="stat-value">{mostSeen.moviesSeen}</div>
					<div className="stat-value-small">{mostSeen.voterName}</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">Fewest Movies Seen</div>
					<div className="stat-value">{leastSeen.moviesSeen}</div>
					<div className="stat-value-small">{leastSeen.voterName}</div>
				</div>
			</div>

			{/* Leaderboard Table */}
			<div className="table-container">
				<table className="results-table">
					<thead>
						<tr>
							<th>Rank</th>
							<th>Voter Name</th>
							<th>Movies Seen</th>
							<th>Want to See</th>
							<th>Voted</th>
						</tr>
					</thead>
					<tbody>
						{leaderboard.map((entry, index) => (
							<tr
								key={entry.clientId}
								className={index === 0 ? "top-three" : ""}
							>
								<td>
									{index === 0 && "🥇 "}
									{index === 1 && "🥈 "}
									{index === 2 && "🥉 "}
									{index + 1}
								</td>
								<td className="movie-title-cell">
									{entry.voterName || "Anonymous"}
								</td>
								<td>
									<strong>{entry.moviesSeen}</strong>
								</td>
								<td>{entry.wantToSee}</td>
								<td>{new Date(entry.timestamp).toLocaleString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

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

export default Leaderboard;
