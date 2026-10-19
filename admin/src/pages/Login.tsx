import { useState } from "react";
import { useAuth } from "../useAuth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      const msg = err?.body?.error || (err instanceof Error ? err.message : String(err));
      if (msg === "rate_limited") {
        const retrySec = err?.body?.retryAfterSeconds || 60;
        setError(`Too many sign-in attempts. Please wait ${retrySec} seconds and try again.`);
      } else if (msg === "Incorrect email or password") {
        setError("Incorrect email or password. Please try again.");
      } else {
        setError(msg || "Could not sign in");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">Gagan</div>
        <div className="brand-kicker">Operations console</div>
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 650 }}>Employee sign in</h2>

        {error && <div className="banner error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
