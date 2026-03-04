import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RSVP from './pages/RSVP';
import Info from './pages/Info';
import History from './pages/History';
import HallOfFame from './pages/HallOfFame';
import Media from './pages/Media';
import NomineesGuide from './pages/NomineesGuide';
import Vote from './pages/Vote/Vote';
import AdminDashboard from './pages/Admin/Dashboard';
import Presentation from './pages/Admin/Presentation';
import BackstageTimer from './pages/BackstageTimer';
import './index.css';

const DEFAULT_ADMIN_SLUG = 'results-HOST2026';
const configuredAdminSlug = import.meta.env.VITE_ADMIN_SLUG?.trim();
const adminSlug = configuredAdminSlug || DEFAULT_ADMIN_SLUG;
const adminRoutePath = `/${adminSlug.replace(/^\/+/, '')}`;

function AppContent() {
  const location = useLocation();
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
