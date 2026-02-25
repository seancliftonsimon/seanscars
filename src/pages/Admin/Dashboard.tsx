import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Overview from "../../components/Admin/Overview";
import RawBallots from "../../components/Admin/RawBallots";
import Leaderboard from "../../components/Admin/Leaderboard";
import Export from "../../components/Admin/Export";
import "./Admin.css";

const Dashboard = () => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<
		| "overview"
		| "leaderboard"
		| "ballots"
		| "export"
	>("ballots");

	useEffect(() => {
		const interval = setInterval(() => {
			window.dispatchEvent(new Event("refresh-data"));
		}, 30000);

		return () => {
			if (interval) clearInterval(interval);
		};
	}, []);

	return (
		<div className="admin-dashboard">
			<div className="admin-header">
				<h1>Admin Dashboard</h1>
			</div>

			<div className="admin-tabs">
				<button
					className={`admin-tab ${activeTab === "ballots" ? "active" : ""}`}
					onClick={() => setActiveTab("ballots")}
				>
					Raw Ballots
				</button>
				<button
					className={`admin-tab ${activeTab === "overview" ? "active" : ""}`}
					onClick={() => setActiveTab("overview")}
				>
					Overview
				</button>
				<button
					className={`admin-tab ${activeTab === "leaderboard" ? "active" : ""}`}
					onClick={() => setActiveTab("leaderboard")}
				>
					Leaderboard
				</button>
				<button
					className={`admin-tab ${activeTab === "export" ? "active" : ""}`}
					onClick={() => setActiveTab("export")}
				>
					Export
				</button>
			</div>

			<div className="admin-content">
				{activeTab === "overview" && <Overview />}
				{activeTab === "leaderboard" && <Leaderboard />}
				{activeTab === "ballots" && (
					<RawBallots onAnalyzePresentation={() => navigate("present")} />
				)}
				{activeTab === "export" && <Export />}
			</div>
		</div>
	);
};

export default Dashboard;
