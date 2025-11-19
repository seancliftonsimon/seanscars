import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RSVP from './pages/RSVP';
import Info from './pages/Info';
import History from './pages/History';
import HallOfFame from './pages/HallOfFame';
import Media from './pages/Media';
import './index.css';

function App() {
  return (
    <Router basename="/seanscars">
      <div className="app">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rsvp" element={<RSVP />} />
            <Route path="/info" element={<Info />} />
            <Route path="/history" element={<History />} />
            <Route path="/hall-of-fame" element={<HallOfFame />} />
            <Route path="/media" element={<Media />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
