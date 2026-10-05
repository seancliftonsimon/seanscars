import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { usePlannerPasscode } from './hooks/usePlannerPasscode';
import SeasonProvider from './components/SeasonProvider';
import PlannerDataProvider from './components/PlannerDataProvider';
import PlannerLayout from './components/PlannerLayout';
import { ToastProvider } from './components/ui/Toast';
import PasscodeScreen from './screens/auth/PasscodeScreen';
import HomeScreen from './screens/home/HomeScreen';
import SeasonSettings from './screens/season/SeasonSettings';
import ImportScreen from './screens/import/ImportScreen';
import ShowScreen from './screens/show/ShowScreen';
import PrintScreen from './screens/show/PrintScreen';
import ReadyScreen from './screens/show/ReadyScreen';
import MakeScreen from './screens/make/MakeScreen';
import SongEditor from './screens/make/SongEditor';
import SingerSheet from './screens/make/SingerSheet';
import IdeasScreen from './screens/ideas/IdeasScreen';
import GuestsScreen from './screens/guests/GuestsScreen';
import DoorList from './screens/guests/DoorList';
import PrepScreen from './screens/prep/PrepScreen';
import { LEGACY_PATHS, legacySearch } from './routes';
import './planner.css';
import './components/ui/ui.css';
import './components/blocks/blocks.css';

/** Old section paths redirect, translating their query (?tab=inbox, ?tab=pieces&piece=…). */
function Legacy({ from }: { from: string }) {
  const { search } = useLocation();
  return <Navigate to={`/plan/${LEGACY_PATHS[from]}${legacySearch(from, search)}`} replace />;
}

/** Route root for /plan/*: passcode gate, then the planner shell. */
export default function PlannerApp() {
  const { unlocked, unlock, lock } = usePlannerPasscode();

  if (!unlocked) {
    return <PasscodeScreen onUnlock={unlock} />;
  }

  return (
    <SeasonProvider>
      <PlannerDataProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="*"
              element={
                <PlannerLayout onSignOut={lock}>
                  <Routes>
                    <Route index element={<HomeScreen />} />
                    <Route path="guests" element={<GuestsScreen />} />
                    <Route path="show" element={<ShowScreen />} />
                    <Route path="show/ready" element={<ReadyScreen />} />
                    <Route path="show/print" element={<PrintScreen />} />
                    <Route path="guests/door" element={<DoorList />} />
                    <Route path="make" element={<MakeScreen />} />
                    <Route path="make/song/:songId" element={<SongEditor />} />
                    <Route path="make/song/:songId/sheet" element={<SingerSheet />} />
                    <Route path="prep" element={<PrepScreen />} />
                    <Route path="ideas" element={<IdeasScreen />} />
                    <Route path="season" element={<SeasonSettings />} />
                    <Route path="import" element={<ImportScreen />} />
                    {Object.keys(LEGACY_PATHS).map((from) => (
                      <Route key={from} path={from} element={<Legacy from={from} />} />
                    ))}
                    <Route path="*" element={<Navigate to="/plan" replace />} />
                  </Routes>
                </PlannerLayout>
              }
            />
          </Routes>
        </ToastProvider>
      </PlannerDataProvider>
    </SeasonProvider>
  );
}
