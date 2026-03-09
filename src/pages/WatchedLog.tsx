import { useMemo } from 'react';
import { watchedLog } from '../data/watchedLog';
import './WatchedLog.css';

const WatchedLog = () => {
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, typeof watchedLog>();
    for (const entry of watchedLog) {
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, []);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="watched-log-page">
      <div className="watched-log-hero">
        <div className="container">
          <h1 className="fade-in">Watched Log</h1>
          <p className="watched-log-subtitle fade-in">
            Movies we&apos;ve watched together
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="watched-log-timeline">
            {entriesByDate.map(([date, entries]) => (
              <div key={date} className="watched-log-date-group">
                <div className="watched-log-date-badge">{formatDate(date)}</div>
                <ul className="watched-log-entries">
                  {entries.map((entry) => (
                    <li key={entry.id} className="watched-log-entry">
                      <span className="watched-log-title">{entry.title}</span>
                      <span
                        className={`watched-log-owner owner-${entry.owner}`}
                        title={entry.owner}
                      >
                        {entry.owner}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WatchedLog;
