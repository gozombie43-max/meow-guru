"use client";

import { useEffect, useRef } from "react";

const SEGMENTS = 28;
const BODY_LENGTH = 58;
const SPEED = 38;

export default function PracticeCurveSnakes() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const grid = svg?.parentElement;
    if (!svg || !grid) return;
    const route = svg.querySelector<SVGPathElement>("[data-route]")!;
    const snakes = Array.from(svg.querySelectorAll<SVGGElement>("[data-snake]"));
    const parts = snakes.map((snake) => ({
      head: snake.querySelector<SVGGElement>("[data-head]")!,
      scales: Array.from(snake.querySelectorAll<SVGGElement>("[data-scale]")),
    }));
    let length = 0;
    let frame = 0;
    let distance = 0;
    let previous = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const measure = () => {
      const bounds = grid.getBoundingClientRect();
      const tabs = Array.from(grid.querySelectorAll<HTMLElement>(".sg-card-tab"));
      let d = "";
      tabs.forEach((tab, index) => {
        const rect = tab.getBoundingClientRect();
        const x = rect.left - bounds.left;
        const y = rect.top - bounds.top;
        const sx = rect.width / 88;
        const sy = rect.height / 46;
        const edge = x + 28 * sx;
        // Match the card's SVG curve exactly and join the gaps vertically.
        d += index === 0 ? `M${edge},${y} ` : `L${edge},${y} `;
        d += `C${edge},${y + 10 * sy} ${x},${y + 13 * sy} ${x},${y + 23 * sy} `;
        d += `C${x},${y + 33 * sy} ${edge},${y + 36 * sy} ${edge},${y + 46 * sy} `;
      });
      route.setAttribute("d", d);
      length = d ? route.getTotalLength() : 0;
      svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    };

    const place = (node: SVGGElement, position: number) => {
      const visible = position >= 0 && position <= length;
      node.style.visibility = visible ? "visible" : "hidden";
      if (!visible) return;
      const point = route.getPointAtLength(position);
      const before = route.getPointAtLength(Math.max(0, position - 0.5));
      const after = route.getPointAtLength(Math.min(length, position + 0.5));
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      node.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
    };

    const animate = (now: number) => {
      if (previous) distance += Math.min(now - previous, 50) / 1000 * SPEED;
      previous = now;
      if (length) {
        const cycle = length + BODY_LENGTH + 20;
        parts.forEach(({ head, scales }, index) => {
          const position = (distance + index * cycle / 2) % cycle;
          place(head, position);
          scales.forEach((scale, segment) => {
            place(scale, position - (SEGMENTS - segment) * BODY_LENGTH / SEGMENTS);
          });
        });
      }
      frame = requestAnimationFrame(animate);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      svg.style.visibility = reduced.matches ? "hidden" : "visible";
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.querySelectorAll(".sg-card-tab").forEach((tab) => observer.observe(tab));
    measure();
    syncMotion();
    reduced.addEventListener("change", syncMotion);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <svg ref={svgRef} className="sg-snakes-overlay" aria-hidden="true" focusable="false">
      <path data-route="" fill="none" stroke="none" />
      {[0, 1].map((snake) => (
        <g key={snake} data-snake="" className="sg-curve-snake">
          {Array.from({ length: SEGMENTS }, (_, index) => {
            const radius = 0.45 + 3.2 * Math.sin((index + 1) / SEGMENTS * Math.PI / 2);
            return (
              <g key={index} data-scale="" visibility="hidden">
                <ellipse rx="2.4" ry={radius} fill="#0877dc" stroke="#054a91" strokeWidth="0.45" />
                <path d={`M-1,${-radius * 0.65} Q1,0 -1,${radius * 0.65}`} fill="none" stroke="#58b9ff" strokeWidth="0.65" />
                <ellipse cy={-radius * 0.55} rx="1.2" ry="0.45" fill="#a4e0ff" opacity="0.65" />
              </g>
            );
          })}
          <g data-head="" visibility="hidden">
            <path d="M-5,-3.3 Q-1,-6 4,-3.7 Q8,-2.3 8,0 Q8,2.3 4,3.7 Q-1,6 -5,3.3Z" fill="#0a84ff" stroke="#0753a0" strokeWidth="0.8" />
            <path d="M-3,-2 Q1,-3 5,-1.5" fill="none" stroke="#80ceff" strokeWidth="1" />
            <ellipse cx="2" cy="-3.1" rx="1.6" ry="1.3" fill="#d7f2ff" />
            <ellipse cx="2" cy="3.1" rx="1.6" ry="1.3" fill="#d7f2ff" />
            <ellipse cx="2.5" cy="-3.1" rx="0.45" ry="1" fill="#071629" />
            <ellipse cx="2.5" cy="3.1" rx="0.45" ry="1" fill="#071629" />
            <circle cx="6" cy="-1" r="0.4" fill="#073464" />
            <circle cx="6" cy="1" r="0.4" fill="#073464" />
            <path d="M7.5,0H11L13,-1.5M11,0L13,1.5" fill="none" stroke="#65beff" strokeWidth="0.9" strokeLinecap="round" />
          </g>
        </g>
      ))}
    </svg>
  );
}
