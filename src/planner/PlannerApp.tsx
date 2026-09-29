import { Navigate, Route, Routes } from 'react-router-dom';
import { usePlannerPasscode } from './hooks/usePlannerPasscode';
import SeasonProvider from './components/SeasonProvider';
import PlannerLayout from './components/PlannerLayout';
import PasscodeScreen from './screens/auth/PasscodeScreen';
import PlaceholderScreen from './screens/placeholder/PlaceholderScreen';
import SeasonSettings from './screens/season/SeasonSettings';
import { PLANNER_SECTIONS } from './routes';
import './planner.css';

/** Route root for /plan/*: passcode gate, then the planner shell. */
export default function PlannerApp() {
  const { unlocked, unlock, lock } = usePlannerPasscode();

  if (!unlocked) {
    return <PasscodeScreen onUnlock={unlock} />;
  }

  return (
    <SeasonProvider>
      <PlannerLayout email="Planner" onSignOut={lock}>
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
