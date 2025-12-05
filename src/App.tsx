import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RSVP from './pages/RSVP';
import Info from './pages/Info';
import History from './pages/History';
import HallOfFame from './pages/HallOfFame';
import Media from './pages/Media';
import Vote from './pages/Vote/Vote';
import AdminLogin from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import './index.css';

function AppContent() {
  const location = useLocation();
  const hideNavbar = (location.pathname === '/vote' || location.pathname === '/voting') || location.pathname.startsWith('/admin');

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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router basename="/seanscars">
      <AppContent />
    </Router>
  );
}

export default App;
