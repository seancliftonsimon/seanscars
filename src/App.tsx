import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RSVP from './pages/RSVP';
import Info from './pages/Info';
import History from './pages/History';
import HallOfFame from './pages/HallOfFame';
import Media from './pages/Media';
import Vote from './pages/Vote/Vote';
import AdminDashboard from './pages/Admin/Dashboard';
import './index.css';

const DEFAULT_ADMIN_SLUG = 'results-HOST2026';
const configuredAdminSlug = import.meta.env.VITE_ADMIN_SLUG?.trim();
const adminSlug = configuredAdminSlug || DEFAULT_ADMIN_SLUG;
const adminRoutePath = `/${adminSlug.replace(/^\/+/, '')}`;

function AppContent() {
  const location = useLocation();
  const hideNavbar = (location.pathname === '/vote' || location.pathname === '/voting') || location.pathname === adminRoutePath;

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
          <Route path="/vote" element={<Vote />} />
          <Route path="/voting" element={<Vote />} />
          <Route path={adminRoutePath} element={<AdminDashboard />} />
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
