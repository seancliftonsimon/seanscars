import "./Vote.css";

interface StepMessageProps {
	title: string;
	message: string;
	onNext: () => void;
	onBack?: () => void;
	nextLabel?: string;
}

const StepMessage = ({
	title,
	message,
	onNext,
	onBack,
	nextLabel = "Next",
}: StepMessageProps) => {
	return (
		<div className="vote-screen step-message-screen">
			<div className="vote-content step-message-content">
				<h1>{title}</h1>
				<p className="step-message-text">{message}</p>
				<div className="step-message-actions">
					{onBack && (
						<button type="button" onClick={onBack} className="btn btn-secondary">
							Back
						</button>
					)}
					<button type="button" onClick={onNext} className="btn btn-primary btn-large">
						{nextLabel}
					</button>
				</div>
			</div>
		</div>
	);
};

export default StepMessage;
