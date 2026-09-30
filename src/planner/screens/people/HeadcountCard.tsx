import { Link } from 'react-router-dom';
import { Users, Mail, Check, UserPlus, Settings2 } from 'lucide-react';
import { guestOverview } from '../../logic/guestOverview';
import type { SeasonData } from '../../hooks/useSeasonData';
import './people.css';

function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  const percent = total > 0 ? Math.min(100, Math.round(value / total * 100)) : 0;
  return <div className="pl-stat-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>;
}

export default function HeadcountCard({ data, capacity }: { data: SeasonData; capacity: number | undefined }) {
  const { attendance: h, guests, sent, responses, plusOnes } = guestOverview(data.invitations, capacity);
  const over = h.remaining !== null && h.remaining < 0;
  return <div className="pl-people-stats" aria-label="Guest overview">
    <section className={`pl-stat-card pl-stat-gold${over ? ' is-over' : ''}`}>
      <span className="pl-stat-icon"><Users size={25} aria-hidden="true" /></span>
      <div className="pl-stat-content"><div className="pl-stat-label">Attendance <Link to="/plan/season" aria-label="Edit venue capacity"><Settings2 size={16} /></Link></div>
        <strong className="pl-stat-value">{h.total}{capacity !== undefined && <span> / {capacity}</span>}</strong>
        <p className="pl-stat-caption">{h.confirmedPeople} confirmed + {h.confirmedPlusOnes} plus-ones</p>
      </div>
      {capacity !== undefined ? <><Meter value={h.total} total={capacity} label="Confirmed attendance vs capacity" /><p className="pl-stat-foot">{over ? `${-h.remaining!} over capacity` : `${h.remaining} spots remaining`}</p></> : <p className="pl-stat-foot"><Link to="/plan/season">Set venue capacity</Link></p>}
    </section>
    <section className="pl-stat-card pl-stat-blue"><span className="pl-stat-icon"><Mail size={25} aria-hidden="true" /></span><div className="pl-stat-content"><div className="pl-stat-label">Invitations sent</div><strong className="pl-stat-value">{sent} <span>/ {guests}</span></strong><p className="pl-stat-caption">{Math.max(0, guests - sent)} still to invite</p></div><Meter value={sent} total={guests} label="Invitations sent" /><p className="pl-stat-foot">{guests ? Math.round(sent / guests * 100) : 0}% of the guest list</p></section>
    <section className="pl-stat-card pl-stat-green"><span className="pl-stat-icon"><Check size={27} aria-hidden="true" /></span><div className="pl-stat-content"><div className="pl-stat-label">RSVPs received</div><strong className="pl-stat-value">{responses} <span>/ {sent}</span></strong><p className="pl-stat-caption">{h.confirmedPeople} confirmed · {h.declined} declined{h.maybe > 0 ? ` · ${h.maybe} maybe` : ''}</p></div><Meter value={responses} total={sent} label="RSVP response rate" /><p className="pl-stat-foot">{h.unanswered} awaiting a reply</p></section>
    <section className="pl-stat-card pl-stat-purple"><span className="pl-stat-icon"><UserPlus size={25} aria-hidden="true" /></span><div className="pl-stat-content"><div className="pl-stat-label">Plus-ones</div><strong className="pl-stat-value">{h.confirmedPlusOnes} <small>confirmed</small></strong><p className="pl-stat-caption">{plusOnes} across the guest list</p></div><Meter value={h.confirmedPlusOnes} total={plusOnes} label="Confirmed plus-ones" /><p className="pl-stat-foot">Included in confirmed attendance</p></section>
  </div>;
}
