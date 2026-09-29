import { Navigate, Route, Routes } from 'react-router-dom';
import { usePlannerAuth } from './hooks/usePlannerAuth';
import SeasonProvider from './components/SeasonProvider';
import PlannerLayout from './components/PlannerLayout';
import SignInScreen from './screens/auth/SignInScreen';
import NotAllowedScreen from './screens/auth/NotAllowedScreen';
import PlaceholderScreen from './screens/placeholder/PlaceholderScreen';
import SeasonSettings from './screens/season/SeasonSettings';
import { PLANNER_SECTIONS } from './routes';
import './planner.css';

/** Route root for /plan/*: auth gate, then the planner shell. */
export default function PlannerApp() {
  const { status, user, error, signIn, signOut } = usePlannerAuth();

  if (status === 'loading') {
    return (
      <div className="pl-root pl-gate">
        <p className="pl-muted">Checking sign-in…</p>
      </div>
    );
  }

  if (status === 'signed-out') {
    return <SignInScreen onSignIn={signIn} error={error} />;
  }

  if (status === 'not-allowed') {
    return <NotAllowedScreen email={user?.email ?? null} error={error} onSignOut={signOut} />;
  }

  return (
    <SeasonProvider>
      <PlannerLayout email={user?.email ?? ''} onSignOut={signOut}>
        <Routes>
          {PLANNER_SECTIONS.filter((s) => s.path !== 'season').map((section) =>
            section.path === '' ? (
              <Route key="index" index element={<PlaceholderScreen section={section} />} />
            ) : (
              <Route key={section.path} path={section.path} element={<PlaceholderScreen section={section} />} />
            ),
          )}
          <Route path="season" element={<SeasonSettings />} />
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Routes>
      </PlannerLayout>
    </SeasonProvider>
  );
}
