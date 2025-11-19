import { useState } from 'react';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import './History.css';

const History = () => {
    const [selectedCategory, setSelectedCategory] = useState<number | null>(1);

    const toggleCategory = (categoryId: number) => {
        setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
    };

    const isExpanded = selectedCategory === 1;

    return (
        <div className="history-page">
            <div className="history-hero">
                <div className="container">
                    <h1 className="fade-in">Past Winners</h1>
                    <p className="history-subtitle fade-in">Celebrating excellence in cinema through the years</p>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    {/* Categories */}
                    <div className="categories-list">
                        <div className="category-card">
                            <button
                                className="category-header"
                                onClick={() => toggleCategory(1)}
                            >
                                <div className="category-title">
                                    <Trophy className="category-icon" />
                                    <div>
                                        <h3>Placeholder Category</h3>
                                        <p className="category-description">Placeholder description</p>
                                    </div>
                                </div>
                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                            </button>

                            {isExpanded && (
                                <div className="category-content">
                                    <div className="winner-section">
                                        <div className="winner-badge">Winner</div>
                                        <h4 className="winner-name">Placeholder Winner</h4>
                                    </div>

                                    <div className="nominees-section">
                                        <h5>Nominees</h5>
                                        <ul className="nominees-list">
                                            <li>Placeholder Nominee 1</li>
                                            <li>Placeholder Nominee 2</li>
                                            <li>Placeholder Nominee 3</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default History;
