import React, { useEffect, useRef, useState } from 'react';

type Props = {
  text?: string | null;
  className?: string;
  speed?: number; // px per second
  pauseOnHover?: boolean;
};

export default function AutoScrollText({ text, className = '', speed = 60, pauseOnHover = true }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Rendered inner will contain two copies when scrolling is active.
    // Measure single-copy width by temporarily using a single child.
    // We'll measure the scrollWidth of inner (which may be two copies) and divide accordingly.
    const singleWidth = inner.dataset.singleWidth ? Number(inner.dataset.singleWidth) : 0;

    // If we haven't measured singleWidth, measure by setting a flag.
    // Simpler: measure outer and first child width.
    const firstChild = inner.querySelector('[data-marker]') as HTMLElement | null;
    const single = firstChild ? firstChild.offsetWidth : inner.scrollWidth;

    const overflow = single > outer.clientWidth + 1;
    setShouldScroll(overflow);
    if (overflow) {
      const px = single; // distance to scroll
      setDistance(px);
      const secs = Math.max(4, px / speed);
      setDuration(secs);
    } else {
      setDistance(0);
      setDuration(0);
    }
  }, [text, speed]);

  const content = (text ?? '-');

  return (
    <div
      ref={outerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
      style={{ position: 'relative' }}
    >
      <div
        ref={innerRef}
        style={shouldScroll ? { display: 'inline-block', whiteSpace: 'nowrap', willChange: 'transform', animation: `auto-scroll ${duration}s linear infinite` } : { display: 'inline-block' }}
      >
        <span data-marker style={{ display: 'inline-block', paddingRight: shouldScroll ? '2rem' : undefined }}>{content}</span>
        {shouldScroll && <span style={{ display: 'inline-block', paddingRight: '2rem' }}>{content}</span>}
      </div>

      <style>{`
        @keyframes auto-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-1 * ${distance}px)); }
        }
        .auto-scroll-pause:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
