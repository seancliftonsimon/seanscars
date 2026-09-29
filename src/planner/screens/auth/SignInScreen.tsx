interface Props {
  onSignIn: () => void;
  error: string | null;
}

export default function SignInScreen({ onSignIn, error }: Props) {
  return (
    <div className="pl-root pl-gate">
      <div className="pl-gate-card">
        <h1>Sharemony Planner</h1>
        <p className="pl-muted">Private planning tool. Sign in with an approved Google account.</p>
        <button type="button" className="pl-btn pl-btn-primary" onClick={onSignIn}>
          Sign in with Google
        </button>
        {error && <p className="pl-error">{error}</p>}
      </div>
    </div>
  );
}
