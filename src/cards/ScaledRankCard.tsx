import React, { useEffect, useRef, useState } from 'react';
import { RankCard, CARD_WIDTH, CARD_HEIGHT } from './RankCard';
import type { RankCardData } from './types';

/**
 * Renders the fixed-size 800×250 <RankCard> scaled down to fit its container
 * width (never scaled up past 1:1). Shared by the Card Studio preview and the
 * profile page so the scaling behavior stays consistent.
 */
export const ScaledRankCard: React.FC<{ data: RankCardData }> = ({ data }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / CARD_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: CARD_HEIGHT * scale, overflow: 'hidden' }}>
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <RankCard data={data} />
      </div>
    </div>
  );
};

export default ScaledRankCard;
