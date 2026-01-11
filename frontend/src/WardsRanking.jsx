import React, { useState, useMemo } from 'react';

const WardsRanking = ({ mapData, currentFactors, onClose }) => {
  const [activeTab, setActiveTab] = useState('overall');
  const [isAscending, setIsAscending] = useState(true); 
  const [searchQuery, setSearchQuery] = useState('');
  console.log(currentFactors);
  const tabColors = {
    overall: { active: '#1e293b', text: '#ffffff' },
    air: { active: '#f59e0b', text: '#ffffff' },
    water: { active: '#0ea5e9', text: '#ffffff' },
    soil: { active: '#84cc16', text: '#ffffff' }
  };

  const rankedData = useMemo(() => {
    if (!mapData || !mapData.features) return [];

    const list = mapData.features
      .filter(f => f.properties.id && f.properties.id !== '#' && f.properties.type !== 'water')
      .map(f => {
        const simAir = Math.round((f.properties.baseStats?.air || 0) * currentFactors.air);
        const simWater = Math.round((f.properties.baseStats?.water || 0) *(currentFactors?.water || 1));
        const simSoil = Math.round((f.properties.baseStats?.soil || 0) * currentFactors.soil);
        
        return {
          id: f.properties.id,
          name: f.properties.id,
          air: simAir,
          water: simWater,
          soil: simSoil,
          overall: Math.round((simAir + simWater + simSoil) / 3)
        };
      })
      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const uniqueList = Array.from(new Map(list.map(item => [item.id, item])).values());

    return uniqueList.sort((a, b) => {
      const valA = a[activeTab];
      const valB = b[activeTab];
      return isAscending ? valA - valB : valB - valA;
    });
  }, [mapData, activeTab, isAscending, searchQuery, currentFactors]);

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      zIndex: 2000, background: 'rgba(255, 255, 255, 0.98)', width: '420px', height: '75vh',
      borderRadius: '24px', boxShadow: '0 40px 80px rgba(0,0,0,0.18)', padding: '28px',
      display: 'flex', flexDirection: 'column', fontFamily: "'Manrope', sans-serif", 
      backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          {/* GRADIENT HEADING START */}
          <h2 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: '900', 
            background: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px'
          }}>
            🏆 Ward Rankings
          </h2>
          {/* GRADIENT HEADING END */}
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
             {isAscending ? 'Cleanest First' : 'Most Polluted First'}
          </span>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      {/* Search Bar */}
      <input 
        type="text" 
        placeholder="Search ward..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '15px', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
      />

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', padding: '5px', borderRadius: '14px' }}>
        {['overall', 'air', 'water', 'soil'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: '10px', cursor: 'pointer',
              textTransform: 'capitalize', fontWeight: '700', fontSize: '11px', transition: '0.2s',
              background: activeTab === tab ? tabColors[tab].active : 'transparent',
              color: activeTab === tab ? tabColors[tab].text : '#64748b',
            }}
          >
            {tab === 'soil' ? 'Land' : tab}
          </button>
        ))}
      </div>

      {/* Simple Table Header */}
      <div style={{ display: 'flex', padding: '0 10px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '10px', fontWeight: '800', color: '#cbd5e0', textTransform: 'uppercase' }}>
        <span style={{ width: '40px' }}>Rank</span>
        <span style={{ flex: 1 }}>Ward</span>
        <span 
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isAscending ? '#10b981' : '#ef4444' }}
          onClick={() => setIsAscending(!isAscending)}
        >
          {activeTab} {isAscending ? '▲' : '▼'}
        </span>
      </div>

      {/* Ranking List */}
      <div style={{ overflowY: 'auto', flex: 1, marginTop: '5px' }}>
        {rankedData.map((item, index) => {
          const val = item[activeTab];
          return (
            <div key={item.id} style={{ 
              display: 'flex', alignItems: 'center', padding: '14px 10px', 
              borderBottom: '1px solid #f8fafc'
            }}>
              <span style={{ width: '40px', fontWeight: '700', color: '#94a3b8', fontSize: '12px' }}>
                #{index + 1}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>{item.name}</span>
              </div>
              <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px', minWidth: '35px', textAlign: 'right' }}>
                {val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WardsRanking;