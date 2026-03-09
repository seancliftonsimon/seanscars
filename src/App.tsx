import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RSVP from './pages/RSVP';
import Info from './pages/Info';
import History from './pages/History';
import HallOfFame from './pages/HallOfFame';
import WatchedLog from './pages/WatchedLog';
import Media from './pages/Media';
import NomineesGuide from './pages/NomineesGuide';
import Vote from './pages/Vote/Vote';
import AdminDashboard from './pages/Admin/Dashboard';
import Presentation from './pages/Admin/Presentation';
import BackstageTimer from './pages/BackstageTimer';
import './index.css';

const BASE_TITLE = 'The 2026 Award Sharemony';

const DEFAULT_ADMIN_SLUG = 'results-HOST2026';
const configuredAdminSlug = import.meta.env.VITE_ADMIN_SLUG?.trim();
const adminSlug = configuredAdminSlug || DEFAULT_ADMIN_SLUG;
const adminRoutePath = `/${adminSlug.replace(/^\/+/, '')}`;

function getPageTitle(pathname: string): string {
  if (pathname === '/') return `Home | ${BASE_TITLE}`;
  if (pathname === '/rsvp') return `RSVP | ${BASE_TITLE}`;
  if (pathname === '/info') return `Event Info | ${BASE_TITLE}`;
  if (pathname === '/history') return `History | ${BASE_TITLE}`;
  if (pathname === '/watched-log') return `Watched Log | ${BASE_TITLE}`;
  if (pathname === '/hall-of-fame') return `Hall of Fame | ${BASE_TITLE}`;
  if (pathname === '/media') return `Past Songs | ${BASE_TITLE}`;
  if (pathname === '/nominees') return `Adam Awards | ${BASE_TITLE}`;
  if (pathname === '/vote' || pathname === '/voting') return `Vote | ${BASE_TITLE}`;
  if (pathname === '/backstage' || pathname === '/timer') return `Backstage Timer | ${BASE_TITLE}`;
  if (pathname === `${adminRoutePath}/present`) return `Presentation | ${BASE_TITLE}`;
  if (pathname === adminRoutePath || pathname.startsWith(`${adminRoutePath}/`)) return `Admin Dashboard | ${BASE_TITLE}`;
  return BASE_TITLE;
}

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);
  const isVotePath = location.pathname === '/vote' || location.pathname === '/voting';
  const isBackstagePath = location.pathname === '/backstage' || location.pathname === '/timer';
  const isAdminPath =
    location.pathname === adminRoutePath ||
    location.pathname.startsWith(`${adminRoutePath}/`);
  const hideNavbar = isVotePath || isAdminPath || isBackstagePath;

  return (
    <div className="app">
      {!hideNavbar && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rsvp" element={<RSVP />} />
          <Route path="/info" element={<Info />} />
          <Route path="/history" element={<History />} />
          <Route path="/watched-log" element={<WatchedLog />} />
          <Route path="/hall-of-fame" element={<HallOfFame />} />
          <Route path="/media" element={<Media />} />
          <Route path="/nominees" element={<NomineesGuide />} />
          <Route path="/vote" element={<Vote />} />
          <Route path="/voting" element={<Vote />} />
          <Route path="/backstage" element={<BackstageTimer />} />
          <Route path="/timer" element={<BackstageTimer />} />
          <Route path={adminRoutePath} element={<AdminDashboard />} />
          <Route path={`${adminRoutePath}/present`} element={<Presentation />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
