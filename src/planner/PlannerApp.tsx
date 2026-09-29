import { Navigate, Route, Routes } from 'react-router-dom';
import { usePlannerPasscode } from './hooks/usePlannerPasscode';
import SeasonProvider from './components/SeasonProvider';
import PlannerLayout from './components/PlannerLayout';
import PasscodeScreen from './screens/auth/PasscodeScreen';
import PlaceholderScreen from './screens/placeholder/PlaceholderScreen';
import SeasonSettings from './screens/season/SeasonSettings';
import ImportScreen from './screens/import/ImportScreen';
import ShowScreen from './screens/show/ShowScreen';
import PrintScreen from './screens/show/PrintScreen';
import AwardsScreen from './screens/awards/AwardsScreen';
import FilmsScreen from './screens/films/FilmsScreen';
import PeopleScreen from './screens/people/PeopleScreen';
import LogisticsScreen from './screens/logistics/LogisticsScreen';
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
          {PLANNER_SECTIONS.filter((s) => !['season', 'import', 'show', 'show/print', 'awards', 'films', 'people', 'logistics'].includes(s.path)).map((section) =>
            section.path === '' ? (
              <Route key="index" index element={<PlaceholderScreen section={section} />} />
            ) : (
              <Route key={section.path} path={section.path} element={<PlaceholderScreen section={section} />} />
            ),
          )}
          <Route path="season" element={<SeasonSettings />} />
          <Route path="import" element={<ImportScreen />} />
          <Route path="show" element={<ShowScreen />} />
          <Route path="show/print" element={<PrintScreen />} />
          <Route path="awards" element={<AwardsScreen />} />
          <Route path="films" element={<FilmsScreen />} />
          <Route path="people" element={<PeopleScreen />} />
          <Route path="logistics" element={<LogisticsScreen />} />
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Routes>
      </PlannerLayout>
    </SeasonProvider>
  );
}
