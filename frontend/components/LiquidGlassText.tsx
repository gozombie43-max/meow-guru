import React from 'react';

export default function LiquidGlassText() {
  return (
    <div 
      className="relative flex items-center justify-center min-h-screen w-full overflow-hidden bg-cover bg-center" 
      style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=2000&auto=format&fit=crop")' }}
    >
      <h1 
        className="liquid-glass-text font-sans font-bold text-center z-10"
        data-text="STUDY WITH GURU"
      >
        STUDY WITH GURU
      </h1>

      <style dangerouslySetInnerHTML={{ __html: `
        .liquid-glass-text {
          font-size: 8rem;
          line-height: 1;
          letter-spacing: 0.05em;
          position: relative;
          
          /* The transparent base of the glass */
          color: transparent;
          
          /* The glass material: slightly white with a heavy blur on what's behind it */
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          
          /* Clip the blurred background strictly to the text shape */
          background-clip: text;
          -webkit-background-clip: text;

          /* Subtle white rim light around the outer edge */
          -webkit-text-stroke: 1px rgba(255, 255, 255, 0.5);

          /* Drop shadow strictly cast by the text hitting the background */
          filter: drop-shadow(0px 15px 25px rgba(0, 0, 0, 0.5));
        }

        /* Top-Left Bright Bevel (Inner Highlight) */
        .liquid-glass-text::before {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          z-index: 2;
          
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          
          /* Shifted shadow to simulate top-left light hitting the glass slope */
          text-shadow: 
            -3px -3px 6px rgba(255, 255, 255, 0.9),
            -1px -1px 2px rgba(255, 255, 255, 1);
          
          pointer-events: none;
          mix-blend-mode: overlay;
        }

        /* Bottom-Right Dark Bevel (Inner Shadow) */
        .liquid-glass-text::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          z-index: 3;
          
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          
          /* Shifted dark shadow to simulate bottom-right thickness */
          text-shadow: 
            3px 3px 8px rgba(0, 0, 0, 0.6),
            1px 1px 3px rgba(0, 0, 0, 0.7);
            
          pointer-events: none;
          mix-blend-mode: multiply;
        }

        /* Responsive scaling */
        @media (max-width: 1024px) {
          .liquid-glass-text { font-size: 5rem; }
        }
        @media (max-width: 640px) {
          .liquid-glass-text { font-size: 3rem; }
          .liquid-glass-text::before { text-shadow: -2px -2px 3px rgba(255,255,255,0.9); }
          .liquid-glass-text::after { text-shadow: 2px 2px 4px rgba(0,0,0,0.6); }
        }
      `}} />
    </div>
  );
}
