'use client';


import Image from 'next/image';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import styles from './mobile-hero-carousel.module.css';

const studySlides = [
  { title: 'Stay Consistent', description: 'Small steps, big results.', image: '/images/home-carousel/study-focus.webp' },
  { title: 'Keep Moving Forward', description: 'One quiz closer to your goal.', image: '/images/home-carousel/exam-focus.webp' },
] as const;
const labels = ['Small steps. Big progress.', ...studySlides.map(slide => slide.title)];

export default function MobileHeroCarousel({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingSlideRef = useRef<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const autoRotate = !reducedMotion && !focused && !hovered && !dragging && !desktop;

  const showSlide = useCallback((index: number) => {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    const first = track?.children[0] as HTMLElement | undefined;
    if (!track || !slide || !first) return;
    pendingSlideRef.current = index;
    track.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior: reducedMotion || index === 0 ? 'instant' : 'smooth' });
    setActiveSlide(index);
  }, [reducedMotion]);

  useEffect(() => {
    if (!autoRotate) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(() => showSlide((activeSlide + 1) % labels.length), 5000);
    };
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [activeSlide, autoRotate, showSlide]);

  const handleNavigation = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    showSlide((activeSlide + (event.key === 'ArrowRight' ? 1 : labels.length - 1)) % labels.length);
  };

  return <section className={styles.carousel} aria-label="Daily study inspiration" aria-roledescription="carousel" data-playing={autoRotate}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div ref={trackRef} className={styles.track} aria-live={autoRotate ? 'off' : 'polite'}
      onPointerDown={() => { pendingSlideRef.current = null; setDragging(true); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
      onScroll={event => {
        const track = event.currentTarget;
        const left = track.getBoundingClientRect().left;
        const slides = Array.from(track.children) as HTMLElement[];
        const pending = pendingSlideRef.current;
        // A smooth transition emits intermediate scroll positions. Keep its
        // destination selected until it settles or a touch gesture interrupts it.
        if (pending !== null) {
          if (Math.abs(slides[pending].getBoundingClientRect().left - left) > 2) return;
          pendingSlideRef.current = null;
        }
        const nearest = slides.reduce((best, slide, index) => Math.abs(slide.getBoundingClientRect().left - left) < Math.abs(slides[best].getBoundingClientRect().left - left) ? index : best, 0);
        setActiveSlide(nearest);
      }}>
      <div className={styles.slide} role="group" aria-roledescription="slide" aria-label="1 of 3" aria-hidden={activeSlide !== 0} inert={activeSlide !== 0}>{children}</div>
      {studySlides.map((slide, index) => <div key={slide.title} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`${index + 2} of 3`} aria-hidden={activeSlide !== index + 1} inert={activeSlide !== index + 1}>
        <article className={styles.studyCard}>
          <Image src={slide.image} alt="" fill sizes="(max-width: 1023px) calc(100vw - 32px), 640px" quality={75} className={styles.studyImage} />
          <div className={styles.studyCopy}><h2>{slide.title}</h2><p>{slide.description}</p></div>
        </article>
      </div>)}

    </div>
    <div className={styles.controls}>
      {labels.map((label, index) => <button key={label} type="button" data-ui-button="state" className={styles.dot} aria-label={`Show card ${index + 1}: ${label}`} aria-current={activeSlide === index ? 'true' : undefined} onClick={() => showSlide(index)} onKeyDown={handleNavigation}><span /></button>)}
    </div>
  </section>;
}
