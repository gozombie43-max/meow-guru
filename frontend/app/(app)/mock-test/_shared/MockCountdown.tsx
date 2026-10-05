'use client';
import { useEffect, useEffectEvent, useState } from 'react';

export default function MockCountdown({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const expire = useEffectEvent(onExpire);
  useEffect(() => {
    const update = () => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) expire();
    };
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [deadline]);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = seconds % 60;
  return <>{[...(h ? [h] : []), m, s].map(value => String(value).padStart(2, '0')).join(':')}</>;
}
