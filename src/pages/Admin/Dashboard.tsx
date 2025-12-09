import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Overview from '../../components/Admin/Overview';
import BestPicture from '../../components/Admin/BestPicture';
import RawBallots from '../../components/Admin/RawBallots';
import UnderSeen from '../../components/Admin/UnderSeen';
import FunCategories from '../../components/Admin/FunCategories';
import Export from '../../components/Admin/Export';
import Testing from '../../components/Admin/Testing';
import './Admin.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'best-picture' | 'under-seen' | 'fun-categories' | 'ballots' | 'export' | 'testing'>('overview');

  useEffect(() => {
    // Check authentication
    const token = sessionStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      // Trigger re-render by updating a state
      window.dispatchEvent(new Event('refresh-data'));
    }, 30000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'best-picture' ? 'active' : ''}`}
          onClick={() => setActiveTab('best-picture')}
        >
          Best Picture
        </button>
        <button
          className={`admin-tab ${activeTab === 'under-seen' ? 'active' : ''}`}
          onClick={() => setActiveTab('under-seen')}
        >
          Under-Seen
        </button>
        <button
          className={`admin-tab ${activeTab === 'fun-categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('fun-categories')}
        >
          Fun Categories
        </button>
        <button
          className={`admin-tab ${activeTab === 'ballots' ? 'active' : ''}`}
          onClick={() => setActiveTab('ballots')}
        >
          Raw Ballots
        </button>
        <button
          className={`admin-tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
        <button
          className={`admin-tab ${activeTab === 'testing' ? 'active' : ''}`}
          onClick={() => setActiveTab('testing')}
        >
          Testing
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && <Overview />}
        {activeTab === 'best-picture' && <BestPicture />}
        {activeTab === 'under-seen' && <UnderSeen />}
        {activeTab === 'fun-categories' && <FunCategories />}
        {activeTab === 'ballots' && <RawBallots />}
        {activeTab === 'export' && <Export />}
        {activeTab === 'testing' && <Testing />}
      </div>
    </div>
  );
};

export default Dashboard;

