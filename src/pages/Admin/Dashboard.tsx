import { useEffect, useState } from "react";
import Overview from "../../components/Admin/Overview";
import BestPicture from "../../components/Admin/BestPicture";
import RawBallots from "../../components/Admin/RawBallots";
import UnderSeen from "../../components/Admin/UnderSeen";
import FunCategories from "../../components/Admin/FunCategories";
import Leaderboard from "../../components/Admin/Leaderboard";
import Export from "../../components/Admin/Export";
import Testing from "../../components/Admin/Testing";
import "./Admin.css";

const Dashboard = () => {
	const [activeTab, setActiveTab] = useState<
		| "overview"
		| "best-picture"
		| "under-seen"
		| "fun-categories"
		| "leaderboard"
		| "ballots"
		| "export"
		| "testing"
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
					className={`admin-tab ${
						activeTab === "best-picture" ? "active" : ""
					}`}
					onClick={() => setActiveTab("best-picture")}
				>
					Best Picture
				</button>
				<button
					className={`admin-tab ${activeTab === "under-seen" ? "active" : ""}`}
					onClick={() => setActiveTab("under-seen")}
				>
					Under-Seen
				</button>
				<button
					className={`admin-tab ${
						activeTab === "fun-categories" ? "active" : ""
					}`}
					onClick={() => setActiveTab("fun-categories")}
				>
					Fun Categories
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
				<button
					className={`admin-tab ${activeTab === "testing" ? "active" : ""}`}
					onClick={() => setActiveTab("testing")}
				>
					Testing
				</button>
			</div>

			<div className="admin-content">
				{activeTab === "overview" && <Overview />}
				{activeTab === "best-picture" && <BestPicture />}
				{activeTab === "under-seen" && <UnderSeen />}
				{activeTab === "fun-categories" && <FunCategories />}
				{activeTab === "leaderboard" && <Leaderboard />}
				{activeTab === "ballots" && (
					<RawBallots onAnalyzePresentation={() => setActiveTab("best-picture")} />
				)}
				{activeTab === "export" && <Export />}
				{activeTab === "testing" && <Testing />}
			</div>
		</div>
	);
};

export default Dashboard;
