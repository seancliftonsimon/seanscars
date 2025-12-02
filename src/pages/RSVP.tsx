import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import './RSVP.css';

const RSVP = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        rsvp: '',
        guestsComment: '',
        attendanceType: '',
        awardName: '',
        brunch: false
    });

    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = e.target;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        const name = target.name;
        
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('https://formspree.io/f/meoykkzy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    rsvp: formData.rsvp,
                    guestsComment: formData.guestsComment,
                    attendanceType: formData.attendanceType,
                    awardName: formData.awardName,
                    brunch: formData.brunch ? 'Yes' : 'No'
                }),
            });

            if (response.ok) {
                setSubmitted(true);
                // Reset form after 3 seconds
                setTimeout(() => {
                    setSubmitted(false);
                    setFormData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        rsvp: '',
                        guestsComment: '',
                        attendanceType: '',
                        awardName: '',
                        brunch: false
                    });
                }, 3000);
            } else {
                throw new Error('Failed to submit RSVP. Please try again.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rsvp-page">
            <div className="rsvp-hero">
                <div className="container">
                    <h1 className="fade-in">R.S.V.P. for the Sharemony</h1>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    <div className="rsvp-content">
                        <div className="rsvp-info slide-in-left">
                            <h2>Event Details</h2>
                            <div className="info-card">
                                <h3>Time</h3>
                                <p>7:00 PM - 10:00 PM</p>
                                <p>Seanity Fair After Party: 10:30 PM</p>
                            </div>

                            <div className="info-card">
                                <h3>Venue</h3>
                                <p><strong>The Eaton Hotel Theater</strong></p>
                                <p>Washington, DC</p>
                            </div>

                            <div className="info-card">
                                <h3>Dress Code</h3>
                                <p>Wear something fancy or flashy that makes you feel good -- think red carpet, or just something you'd wear to a nice dinner.</p>
                            </div>

                            <div className="info-card">
                                <h3>What to Expect</h3>
                                <ul>
                                    <li>Awards Ceremony (7:00 PM - 10:00 PM)</li>
                                    <li>Seanity Fair After Party (10:30 PM)</li>
                                </ul>
                            </div>
                        </div>

                        <div className="rsvp-form-container slide-in-right">
                            {submitted ? (
                                <div className="success-message">
                                    <CheckCircle size={64} />
                                    <h2>Thank You!</h2>
                                    <p>Your RSVP has been received. We look forward to seeing you at the ceremony!</p>
                                </div>
                            ) : (
                                <form className="rsvp-form" onSubmit={handleSubmit}>
                                    {error && (
                                        <div className="error-message" style={{ 
                                            color: '#ff6b6b', 
                                            backgroundColor: 'rgba(255, 107, 107, 0.1)', 
                                            padding: '1rem', 
                                            borderRadius: '0.5rem', 
                                            marginBottom: '1rem',
                                            border: '1px solid rgba(255, 107, 107, 0.3)'
                                        }}>
                                            {error}
                                        </div>
                                    )}
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="firstName">First Name *</label>
                                            <input
                                                type="text"
                                                id="firstName"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="lastName">Last Name *</label>
                                            <input
                                                type="text"
                                                id="lastName"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="email">Email *</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>R.S.V.P. *</label>
                                        <div className="radio-group">
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="rsvp"
                                                    value="enthusiastically"
                                                    checked={formData.rsvp === 'enthusiastically'}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                <span>Enthusiastically Accept</span>
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="rsvp"
                                                    value="tentatively"
                                                    checked={formData.rsvp === 'tentatively'}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                <span>Tentatively Accept</span>
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="rsvp"
                                                    value="regretfully"
                                                    checked={formData.rsvp === 'regretfully'}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                <span>Regretfully Decline</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="guestsComment">Guests / Comment *</label>
                                        <input
                                            type="text"
                                            id="guestsComment"
                                            name="guestsComment"
                                            value={formData.guestsComment}
                                            onChange={handleChange}
                                            placeholder="List any plus ones here - or if you're Godzilla, list a minus one"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>At the Sharemony I'd like to *</label>
                                        <div className="radio-group">
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="attendanceType"
                                                    value="guest"
                                                    checked={formData.attendanceType === 'guest'}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                <span>Attend only as an esteemed guest</span>
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="attendanceType"
                                                    value="present"
                                                    checked={formData.attendanceType === 'present'}
                                                    onChange={handleChange}
                                                    required
                                                />
                                                <span>Present some awards of my own</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="awardName">If you'd like to give our your own awards, what will they be called?</label>
                                        <input
                                            type="text"
                                            id="awardName"
                                            name="awardName"
                                            value={formData.awardName}
                                            onChange={handleChange}
                                            placeholder="The Cole-den Globes"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                name="brunch"
                                                checked={formData.brunch}
                                                onChange={handleChange}
                                            />
                                            <span>The Seancademy organizes a brunch the morning after the Seanscars to debrief and bid out-of-towners farewell. Check this box to be included in the headcount!</span>
                                        </label>
                                    </div>

                                    <button type="submit" className="btn btn-primary btn-submit" disabled={loading}>
                                        <span>{loading ? 'SUBMITTING...' : 'SUBMIT'}</span>
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default RSVP;
