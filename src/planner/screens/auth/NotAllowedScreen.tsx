interface Props {
  email: string | null;
  error: string | null;
  onSignOut: () => void;
}

export default function NotAllowedScreen({ email, error, onSignOut }: Props) {
  return (
    <div className="pl-root pl-gate">
      <div className="pl-gate-card">
        <h1>Not on the planner list</h1>
        <p className="pl-muted">
          {email ? (
            <>
              <strong>{email}</strong> isn't on the planner list.
            </>
          ) : (
            "This account isn't on the planner list."
          )}{' '}
          Sign out and try a different Google account.
        </p>
        {error && <p className="pl-error">{error}</p>}
        <button type="button" className="pl-btn" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
