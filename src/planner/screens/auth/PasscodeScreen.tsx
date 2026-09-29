import { useState, type FormEvent } from 'react';

interface Props {
  onUnlock: (code: string) => Promise<boolean>;
}

export default function PasscodeScreen({ onUnlock }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onUnlock(code);
    setBusy(false);
    if (!ok) {
      setError('That passcode is incorrect.');
      setCode('');
    }
  };

  return (
    <div className="pl-root pl-gate">
      <form className="pl-gate-card" onSubmit={submit}>
        <h1>Sharemony Planner</h1>
        <p className="pl-muted">Enter the passcode.</p>
        <input
          className="pl-input"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          aria-label="Passcode"
        />
        <button type="submit" className="pl-btn pl-btn-primary" disabled={busy || code.length === 0}>
          Open planner
        </button>
        {error && <p className="pl-error">{error}</p>}
      </form>
    </div>
  );
}
