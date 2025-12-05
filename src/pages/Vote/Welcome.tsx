import './Vote.css';

interface WelcomeProps {
  onStart: () => void;
}

const Welcome = ({ onStart }: WelcomeProps) => {
  return (
    <div className="vote-screen welcome-screen">
      <div className="vote-content">
        <h1>Cast Your Vote</h1>
        <p className="welcome-description">
          Help us determine the winners! This will take about 2-3 minutes.
        </p>
        <button onClick={onStart} className="btn btn-primary btn-large">
          Start
        </button>
      </div>
    </div>
  );
};

export default Welcome;

