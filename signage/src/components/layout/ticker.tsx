import { TICKER_ITEMS } from '@/lib/constants';

export default function Ticker() {
  const doubledItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="bg-[#c9a84c] overflow-hidden py-2.5" aria-hidden="true">
      <div className="inline-block whitespace-nowrap" style={{ animation: 'ticker 28s linear infinite' }}>
        {doubledItems.map((item, index) => (
          <span key={index} className="text-sm font-medium uppercase tracking-[0.14em] text-[#0a0a0a]">
            {item}
            <span className="inline-block mx-8 text-[#0a0a0a]/35">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
