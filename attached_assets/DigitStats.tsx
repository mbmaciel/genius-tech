import React from 'react';
import './DigitStats.css';

interface DigitStatsProps {
  digitStats: {
    [key: number]: {
      count: number;
      percentage: number;
    }
  };
}

const DigitStats: React.FC<DigitStatsProps> = ({ digitStats }) => {

  const defaultStats = {
    0: { count: 0, percentage: 0 },
    1: { count: 0, percentage: 0 },
    2: { count: 0, percentage: 0 },
    3: { count: 0, percentage: 0 },
    4: { count: 0, percentage: 0 },
    5: { count: 0, percentage: 0 },
    6: { count: 0, percentage: 0 },
    7: { count: 0, percentage: 0 },
    8: { count: 0, percentage: 0 },
    9: { count: 0, percentage: 0 }
  };

  const stats = Object.keys(digitStats).length > 0 ? digitStats : defaultStats;
  
  const statsArray = Object.entries(stats).map(([digit, stat]) => ({
    digit: parseInt(digit),
    count: stat.count,
    percentage: stat.percentage
  })).sort((a, b) => a.digit - b.digit);
  const getFrequencyClass = (percentage: number): string => {
    if (percentage < 15) return 'frequency-normal';
    if (percentage >= 15 && percentage <= 20) return 'frequency-medium';
    return 'frequency-high';
  };

  return (
    <div className="digit-stats">
      <div className="digit-bars">
        {statsArray.map(stat => (
          <div key={stat.digit} className="digit-stat">
            <div 
              className={`digit-bar ${getFrequencyClass(stat.percentage)}`} 
              style={{ height: `${Math.max(stat.percentage, 3)}%` }}
            >
              <span className="digit-bar-value">
                {stat.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="digit-label">{stat.digit}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DigitStats;