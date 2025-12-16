import { useState } from "react";
import "./Vote.css";

interface WelcomeProps {
	voterName: string;
	onNameChange: (name: string) => void;
	onStart: () => void;
}

const Welcome = ({ voterName, onNameChange, onStart }: WelcomeProps) => {
	const [error, setError] = useState<string | null>(null);

	const handleStart = () => {
		if (voterName.trim().length === 0) {
			setError("Please enter your name to continue");
			return;
		}
		setError(null);
		onStart();
	};

	return (
		<div className="vote-screen welcome-screen">
			<div className="vote-content">
				<h1>Cast Your Vote</h1>
				<p className="welcome-description">
					Help us determine the winners! This will take about 2-3 minutes.
				</p>

				<div style={{ width: "100%", maxWidth: "400px", margin: "2rem auto" }}>
					<label
						htmlFor="voterName"
						className="question-label"
						style={{
							display: "block",
							marginBottom: "0.5rem",
							textAlign: "left",
						}}
					>
						Your Name
					</label>
					<input
						id="voterName"
						type="text"
						value={voterName}
						onChange={(e) => {
							onNameChange(e.target.value);
							setError(null);
						}}
						placeholder="Enter your name"
						className="search-input"
						style={{ marginBottom: "0.5rem", textAlign: "center" }}
						autoFocus
					/>
					{error && (
						<div className="error-message" style={{ marginBottom: "1rem" }}>
							{error}
						</div>
					)}
				</div>

				<button onClick={handleStart} className="btn btn-primary btn-large">
					Start
				</button>
			</div>
		</div>
	);
};

export default Welcome;
