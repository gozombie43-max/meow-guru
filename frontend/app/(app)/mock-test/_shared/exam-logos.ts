const svgToDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const makeTextLogo = (label: string, background: string, accent: string) => svgToDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="${label} logo">
    <defs>
      <linearGradient id="${label.toLowerCase()}Bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${background}" />
        <stop offset="100%" stop-color="${accent}" />
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="28" fill="url(#${label.toLowerCase()}Bg)" />
    <circle cx="80" cy="62" r="34" fill="#ffffff" opacity="0.12" />
    <path d="M40 112h80" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.9" />
    <text x="80" y="84" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#ffffff" letter-spacing="1.5">${label}</text>
  </svg>
`);

const logos: Record<string, string> = {
  ssc: '/images/ssc-logo.webp',
  rrb: '/images/rrb-logo.webp',
  sbi: '/images/sbi-logo.webp',
  ibps: '/images/ibps-logo.webp',
  cat: '/images/cat-logo.webp',
  banking: '/images/sbi-logo.webp',
  upsc: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="UPSC logo">
      <defs>
        <linearGradient id="upscBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#9a3412" />
          <stop offset="100%" stop-color="#c2410c" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#upscBg)" />
      <circle cx="80" cy="58" r="24" fill="#fde68a" opacity="0.9" />
      <path d="M80 34l7 20h21l-17 12 7 20-18-12-18 12 7-20-17-12h21z" fill="#fff7ed" opacity="0.95" />
      <text x="80" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="#fff7ed" letter-spacing="1.5">UPSC</text>
    </svg>
  `),
  uppsc: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="UPPSC logo">
      <defs>
        <linearGradient id="uppscBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#047857" />
          <stop offset="100%" stop-color="#064e3b" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#uppscBg)" />
      <circle cx="80" cy="58" r="30" fill="#34d399" opacity="0.2" />
      <path d="M52 58h56M80 36v44" stroke="#a7f3d0" stroke-width="7" stroke-linecap="round" />
      <circle cx="80" cy="58" r="8" fill="#fef3c7" />
      <text x="80" y="124" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="1.5">UPPSC</text>
    </svg>
  `),
  wbcs: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="WBCS logo">
      <defs>
        <linearGradient id="wbcsBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="28" fill="url(#wbcsBg)" />
      <circle cx="80" cy="56" r="28" fill="#38bdf8" opacity="0.2" />
      <path d="M54 44l26 24 26-24M54 68l26 24 26-24" stroke="#e0f2fe" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <text x="80" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="1.5">WBCS</text>
    </svg>
  `),
  defence: makeTextLogo('DEFENCE', '#4b5563', '#1f2937'),
  cuet: makeTextLogo('CUET', '#7c3aed', '#4338ca'),
};

export const examLogos: Record<string, string | undefined> = {
  'ssc-cgl': logos.ssc,
  'ssc-chsl': logos.ssc,
  'ssc-mts': logos.ssc,
  'ssc-gd': logos.ssc,
  'rrb-ntpc': logos.rrb,
  'rrb-group-d': logos.rrb,
  'rrb-je': logos.rrb,
  'ibps-po': logos.ibps,
  'ibps-clerk': logos.ibps,
  'sbi-po': logos.sbi,
  'sbi-clerk': logos.sbi,
  'upsc': logos.upsc,
  'uppsc': logos.uppsc,
  'wbcs': logos.wbcs,
  'nda': logos.defence,
  'cds': logos.defence,
  'cuet': logos.cuet,
  'cat': logos.cat,
};
