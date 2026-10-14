import styles from './home-card-artwork.module.css';

type Artwork = 'math' | 'reasoning' | 'english' | 'gk' | 'books' | 'battle' | 'recent';

/**
 * Decorative vector artwork — three-tier visual hierarchy:
 *   PRIMARY   opacity .75–.90  → the card's signature shape / focal element
 *   SECONDARY opacity .35–.50  → supporting geometry / structure
 *   TERTIARY  opacity .10–.22  → fine grid / micro-detail
 */
export default function HomeCardArtwork({ kind }: { kind: Artwork }) {
  return (
    <span className={`${styles.artwork} ${styles[kind]}`} aria-hidden="true">
      <svg viewBox="0 0 300 160" fill="none" stroke="currentColor" strokeWidth="1.2" focusable="false">

        {/* ═══════════════════════════════════════════════════════════
            MATH  —  colour: ios-blue  #007aff / #0a84ff
            Focal: sine wave + axis + integral formula
        ════════════════════════════════════════════════════════════ */}
        {kind === 'math' && <>
          {/* TERTIARY — fine graph grid */}
          <path opacity=".13" strokeWidth=".7"
            d="M80 0v160m20-160v160m20-160v160m20-160v160m20-160v160m20-160v160m20-160v160m20-160v160
               M65 20h235M65 40h235M65 60h235M65 80h235M65 100h235M65 120h235M65 140h235" />

          {/* SECONDARY — parabola + dashed cosine */}
          <path opacity=".38" strokeWidth="1.1" d="M118 155 q50-118 100 0" />
          <path opacity=".28" strokeWidth=".9" strokeDasharray="4 4"
            d="M65 80c18-22 36 22 54 0s36-44 54-22 36 44 54 22 36-44 54-22" />
          <path opacity=".35" strokeWidth=".9" d="M148 68 L224 130" />

          {/* SECONDARY — axis lines */}
          <path opacity=".55" strokeWidth="1.6"
            d="M65 110h226m-7-5 7 5-7 5M168 155V10m-5 9 5-9 5 9" />

          {/* SECONDARY — axis tick marks */}
          {[90,110,130,150,190,210].map(x =>
            <line key={x} x1={x} y1="107" x2={x} y2="113" strokeWidth=".9" opacity=".4" />)}
          {[20,40,60,80,120,140].map(y =>
            <line key={y} x1="165" y1={y} x2="171" y2={y} strokeWidth=".9" opacity=".4" />)}

          {/* PRIMARY — sine wave fill */}
          <path fill="currentColor" fillOpacity=".12" strokeWidth="0"
            d="M65 110c18-28 36 28 54 0s36-56 54-28 36 56 54 28 36-56 54-28v58H65Z" />
          {/* PRIMARY — sine wave stroke */}
          <path opacity=".82" strokeWidth="2"
            d="M65 110c18-28 36 28 54 0s36-56 54-28 36 56 54 28 36-56 54-28" />

          {/* PRIMARY — point on curve + halo */}
          <circle cx="168" cy="82" r="4" fill="currentColor" fillOpacity=".85" stroke="none" />
          <circle cx="168" cy="82" r="8" fill="none" strokeWidth=".9" opacity=".45" />

          {/* PRIMARY — integral formula */}
          <text x="200" y="30" fill="currentColor" stroke="none"
            fontSize="22" fontFamily="Georgia,serif" fontStyle="italic" opacity=".88">∫x²dx</text>

          {/* SECONDARY — supporting labels */}
          <text x="207" y="52" fill="currentColor" stroke="none"
            fontSize="10.5" fontFamily="Georgia,serif" opacity=".48">lim f(x)</text>
          <text x="208" y="68" fill="currentColor" stroke="none"
            fontSize="10.5" fontFamily="Georgia,serif" fontStyle="italic" opacity=".40">dy/dx</text>
          <text x="268" y="100" fill="currentColor" stroke="none"
            fontSize="18" fontFamily="Georgia,serif" opacity=".32">π</text>

          {/* TERTIARY — sparkle */}
          <path opacity=".55" strokeWidth=".9" d="m280 42 2 5 5 2-5 2-2 5-2-5-5-2 5-2" />
        </>}

        {/* ═══════════════════════════════════════════════════════════
            REASONING  —  colour: hot-pink  #e5387a / #f0568c
            Focal: 3-D node graph with cubes
        ════════════════════════════════════════════════════════════ */}
        {kind === 'reasoning' && <>
          {/* TERTIARY — dot grid */}
          {([120,160,200,240,280] as number[]).map(x =>
            ([45,85,125] as number[]).map(y =>
              <circle key={`d${x}${y}`} cx={x} cy={y} r=".85" fill="currentColor" stroke="none" opacity=".15" />))}

          {/* TERTIARY — distant diagonal connections */}
          <path opacity=".15" strokeWidth=".7" strokeDasharray="3 5"
            d="M152 38 L245 154 M100 80 L296 125" />

          {/* SECONDARY — inner cross-connections */}
          <path opacity=".25" strokeWidth=".8" strokeDasharray="3 4"
            d="M152 38 L202 66 M202 66 L245 36 M152 130 L245 154 M202 66 L152 130 M245 36 L296 64" />

          {/* SECONDARY — main edge network */}
          <path opacity=".42" strokeWidth="1.1"
            d="m100 80 52-42 50 30 46-32 52 30M100 80v50l52 26 50-28 46 30 52-28
               M152 38V4m50 64v55m46-86V2m52 60v58" />

          {/* PRIMARY — nodes */}
          {([[152,38],[100,80],[202,66],[245,36],[296,64],
             [100,130],[152,156],[202,128],[245,156],[296,126]] as [number,number][]).map(([x,y]) =>
            <circle key={`n${x}${y}`} cx={x} cy={y} r="3.8" fill="currentColor" stroke="none" opacity=".88" />)}
          {/* PRIMARY — node halos on key vertices */}
          {([[152,38],[202,66],[245,36]] as [number,number][]).map(([x,y]) =>
            <circle key={`h${x}${y}`} cx={x} cy={y} r="7.5" fill="none" strokeWidth=".8" opacity=".38" />)}

          {/* PRIMARY — 3-D cubes */}
          {([[220,26,1.15],[255,94,.92],[182,110,.66]] as [number,number,number][]).map(([x,y,s]) =>
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
              <path fill="currentColor" fillOpacity=".20" d="m0 15 26-15 26 15v32L26 62 0 47Z" />
              <path fill="currentColor" fillOpacity=".13" d="m0 15 26 15L52 15 26 0Z" />
              <path fill="currentColor" fillOpacity=".09" d="m26 30 26-15v32L26 62Z" />
              <path opacity=".65" strokeWidth="1.1"
                d="m0 15 26-15 26 15M26 0v15m0 15v32M0 47l26 15 26-15" />
            </g>)}

          {/* SECONDARY — flowing arc */}
          <path opacity=".32" strokeWidth="1" d="M80 155c65-85 110 52 220-42" />
        </>}

        {/* ═══════════════════════════════════════════════════════════
            ENGLISH  —  colour: teal  #00a88e / #1ec9ae
            Focal: giant letterform + ruled lines + pen nib
        ════════════════════════════════════════════════════════════ */}
        {kind === 'english' && <>
          {/* TERTIARY — scattered small letters */}
          <text x="205" y="40" fill="currentColor" fillOpacity=".14" stroke="none"
            fontFamily="Georgia,serif" fontStyle="italic" fontSize="28">d</text>
          <text x="278" y="96" fill="currentColor" fillOpacity=".12" stroke="none"
            fontFamily="Georgia,serif" fontSize="22">e</text>
          <text x="196" y="142" fill="currentColor" fillOpacity=".12" stroke="none"
            fontFamily="Georgia,serif" fontStyle="italic" fontSize="20">f</text>

          {/* SECONDARY — ruled lines */}
          {[0,9,18,27,36].map(y =>
            <path key={y} transform={`translate(0 ${y})`} opacity=".38" strokeWidth="1"
              d="M65 138c55-68 90 28 140-26s62-12 95-58" />)}

          {/* PRIMARY — giant ghost A */}
          <text x="148" y="122" fill="currentColor" fillOpacity=".36" stroke="none"
            fontFamily="Georgia,serif" fontSize="128">A</text>

          {/* PRIMARY — italic b, c */}
          <text x="245" y="65" fill="currentColor" fillOpacity=".72" stroke="none"
            fontFamily="Georgia,serif" fontStyle="italic" fontSize="62">b</text>
          <text x="258" y="152" fill="currentColor" fillOpacity=".60" stroke="none"
            fontFamily="Georgia,serif" fontStyle="italic" fontSize="66">c</text>

          {/* PRIMARY — underline strokes */}
          <path opacity=".55" strokeWidth="2" d="M148 126h112" />
          <path opacity=".22" strokeWidth=".9" d="M148 131h80" />

          {/* PRIMARY — pen nib */}
          <path opacity=".70" strokeWidth="1.4" d="M274 48 L264 61 L260 68 L267 64 Z" />
          <path opacity=".38" strokeWidth="1.1" d="M267 64 L264 76" />

          {/* SECONDARY — crosshair plus */}
          <path opacity=".50" strokeWidth="1.1" d="M140 18v16m-8-8h16M275 77v12m-6-6h12" />
          <path opacity=".30" strokeWidth=".9" d="M228 48v10m-5-5h10" />

          {/* PRIMARY — opening quote */}
          <text x="163" y="52" fill="currentColor" fillOpacity=".22" stroke="none"
            fontFamily="Georgia,serif" fontSize="38">"</text>

          {/* TERTIARY — sparkle */}
          <path opacity=".55" strokeWidth=".8"
            d="m260 30 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5" />
        </>}

        {/* ═══════════════════════════════════════════════════════════
            GK  —  colour: gold  #b87c0a / #e8a825
            Focal: globe + continent fills + orbital rings
        ════════════════════════════════════════════════════════════ */}
        {kind === 'gk' && <>
          {/* TERTIARY — outer dashed orbit */}
          <ellipse cx="226" cy="95" rx="160" ry="66"
            transform="rotate(-32 226 95)" strokeDasharray="4 9" opacity=".20" strokeWidth=".8" />

          {/* SECONDARY — orbital ring */}
          <ellipse cx="230" cy="95" rx="136" ry="52"
            transform="rotate(-32 230 95)" opacity=".42" strokeWidth="1" />

          {/* PRIMARY — globe body */}
          <g transform="rotate(-18 255 95)">
            <circle cx="255" cy="95" r="88"
              fill="currentColor" fillOpacity=".08" strokeWidth="1.8" opacity=".88" />

            {/* SECONDARY — longitude lines */}
            <ellipse cx="255" cy="95" rx="32" ry="88" strokeWidth=".9" opacity=".45" />
            <ellipse cx="255" cy="95" rx="58" ry="88" strokeWidth=".9" opacity=".40" />
            <ellipse cx="255" cy="95" rx="78" ry="88" strokeWidth=".8" opacity=".32" />

            {/* SECONDARY — latitude lines */}
            <ellipse cx="255" cy="95" rx="88" ry="30" strokeWidth=".9" opacity=".45" />
            <ellipse cx="255" cy="95" rx="88" ry="56" strokeWidth=".8" opacity=".38" />
            <ellipse cx="255" cy="95" rx="88" ry="73" strokeWidth=".7" opacity=".28" />

            {/* PRIMARY — continent blobs */}
            <path fill="currentColor" fillOpacity=".38" strokeWidth=".9" opacity=".90"
              d="m205 35 18-10 16 8 5 15 22 9-3 18-19 5-2 20-18 3-10-25-16-9Z" />
            <path fill="currentColor" fillOpacity=".28" strokeWidth=".8" opacity=".82"
              d="m248 90 22-8 19 14-5 20-17 12-10 35-14-15-2-31-10-12Z" />
            <path fill="currentColor" fillOpacity=".20" strokeWidth=".7" opacity=".72"
              d="m222 128 12-6 10 5 3 12 8 4-2 10-10 3-1 9-9 2-5-11-8-5Z" />
          </g>

          {/* PRIMARY — location pin */}
          <circle cx="255" cy="50" r="5.5" fill="currentColor" fillOpacity=".60" strokeWidth="1" />
          <path opacity=".50" strokeWidth="1.3" d="M255 55.5 L255 68" />
          {/* pin signal rings */}
          <circle cx="255" cy="50" r="12" fill="none" strokeWidth=".7" opacity=".30" />
          <circle cx="255" cy="50" r="20" fill="none" strokeWidth=".55" opacity=".18" />

          {/* PRIMARY — star sparkles */}
          <path fill="currentColor" stroke="none" opacity=".78"
            d="m143 40 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" />
          <path fill="currentColor" stroke="none" opacity=".55"
            d="m176 12 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />

          {/* SECONDARY — compass micro */}
          <path opacity=".45" strokeWidth=".9" d="m148 38 3 8 3-8m-3-5v5M141 41h14" />
        </>}

        {/* ═══════════════════════════════════════════════════════════
            BOOKS  —  colour: warm-orange  #c05f12 / #e07830
            Focal: open book + page lines + tilted stacks
        ════════════════════════════════════════════════════════════ */}
        {kind === 'books' && <>
          {/* TERTIARY — background shadow lines */}
          <path opacity=".18" strokeWidth=".7" d="M78 140q50-10 90 14" />
          <path opacity=".14" strokeWidth=".7" d="M82 150q46-12 88 16 46-12 84 10" />

          {/* SECONDARY — left tilted book stack */}
          <g transform="rotate(-15 187 68)" opacity=".55">
            <path fill="currentColor" fillOpacity=".12" d="M132 8h100v120H132z" />
            <path strokeWidth="1" opacity=".85"
              d="M140 8v120m12-96h68m-68 14h68m-68 14h56m-56 14h62m-62 14h50m-50 14h58m-58 14h44" />
            <path strokeWidth="2" opacity=".55" d="M140 8v120" />
          </g>

          {/* SECONDARY — right tilted book */}
          <g transform="rotate(16 262 70)" opacity=".60">
            <path fill="currentColor" fillOpacity=".12" d="M222 10h82v114H222z" />
            <path strokeWidth="1" opacity=".80"
              d="M235 28h52m-52 13h52m-52 13h42m-42 13h48m-48 13h36" />
            <path strokeWidth="2" opacity=".55" d="M235 10v114" />
          </g>

          {/* PRIMARY — open book body */}
          <path fill="currentColor" fillOpacity=".18" strokeWidth="0"
            d="M128 80q50-22 88 16 42-26 84-2l-16 66q-36-22-80-8-38-27-92-14Z" />
          <path opacity=".78" strokeWidth="1.9"
            d="m128 80-16 64q50-16 92 14 44-14 80 8l16-66q-42-24-84 2-38-38-88-16Zm88 16-13 61" />

          {/* PRIMARY — page lines */}
          {[0,11,22,33,44].map(y =>
            <path key={y} transform={`translate(0 ${y})`} opacity=".60" strokeWidth=".95"
              d="M144 90q32-8 64 14m26-2q28-11 56 0" />)}

          {/* PRIMARY — bookmark ribbon */}
          <path fill="currentColor" fillOpacity=".42" strokeWidth=".9" opacity=".72"
            d="M280 10v28l-6-5-6 5V10Z" />

          {/* SECONDARY — reading glasses */}
          <path opacity=".28" strokeWidth=".9"
            d="M92 50 q0-8 10-8 q10 0 10 8 q0 8-10 8 q-10 0-10-8
               M112 50 q0 0 6 0M118 50 q0-8 10-8 q10 0 10 8 q0 8-10 8 q-10 0-10-8" />
        </>}

        {/* ═══════════════════════════════════════════════════════════
            BATTLE  —  colour: sky-blue  #0e85c0 / #1aaee8
            Focal: shield + crown + crossed swords + speed lines
        ════════════════════════════════════════════════════════════ */}
        {kind === 'battle' && <>
          {/* TERTIARY — speed-line rays */}
          {([0,30,62,96,130,162,192] as number[]).map(x =>
            <g key={x} transform={`translate(${x} 0)`}>
              <path opacity=".16" strokeWidth=".85" d="M35 165 185 0m-128 165L210 0" />
              <path fill="currentColor" fillOpacity=".08" stroke="none" d="m62 158 68-88-44 78-28 18Z" />
            </g>)}

          {/* SECONDARY — shield outer */}
          <path fill="currentColor" fillOpacity=".14" strokeWidth="2.2"
            d="M234 24q26 24 56 32-2 66-56 100-54-34-56-100 30-8 56-32Z" />
          {/* SECONDARY — shield inner */}
          <path fill="currentColor" fillOpacity=".09"
            d="M234 37q20 19 44 26-3 52-44 80-41-28-44-80 24-7 44-26Z" />
          {/* SECONDARY — shield rim accent */}
          <path opacity=".42" strokeWidth="1.1" d="M234 39q18 17 42 24" />

          {/* PRIMARY — crown */}
          <path fill="currentColor" fillOpacity=".65" strokeWidth="1"
            d="m211 83 10 11 13-20 13 20 10-11-7 32h-36Z" />
          <path strokeWidth="2.8" opacity=".78" d="M219 119h30" />

          {/* PRIMARY — crown dots */}
          {([[211,81],[234,72],[257,81]] as [number,number][]).map(([x,y]) =>
            <circle key={x} cx={x} cy={y} r="3.4" fill="currentColor" opacity=".90" stroke="none" />)}

          {/* SECONDARY — crossed swords */}
          <path opacity=".48" strokeWidth="1.5" d="M100 135 L140 95 M130 135 L100 95" />
          <path opacity=".28" strokeWidth=".8"
            d="M97 98 L103 92 M127 98 L133 92 M98 135 L104 138 M128 135 L134 138" />

          {/* PRIMARY — lightning bolt */}
          <path fill="currentColor" fillOpacity=".52" strokeWidth="1.1" opacity=".78"
            d="m170 50 8-18 4 10 8-4-8 18-4-10Z" />

          {/* PRIMARY — sparkles */}
          <path strokeWidth=".9" opacity=".68" d="m152 52 2 5 5 2-5 2-2 5-2-5-5-2 5-2" />
          <path strokeWidth=".8" opacity=".55" d="m286 90 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5" />
          <path strokeWidth=".8" opacity=".38" d="m160 120 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5" />

          {/* TERTIARY — hexagonal badge outline */}
          <path opacity=".22" strokeWidth=".9" d="m186 28 14-8 14 8v16l-14 8-14-8Z" />
        </>}

        {/* ═══════════════════════════════════════════════════════════
            RECENT  —  colour: indigo  #6452c8 / #8b76e8
            Focal: checklist + clock + bar-chart trend
        ════════════════════════════════════════════════════════════ */}
        {kind === 'recent' && <>
          {/* TERTIARY — outer dashed orbit */}
          <circle cx="252" cy="88" r="68" strokeDasharray="4 9" opacity=".18" strokeWidth=".8" />
          <circle cx="252" cy="88" r="50" strokeDasharray="2 7" opacity=".12" strokeWidth=".7" />

          {/* SECONDARY — clipboard / checklist */}
          <g transform="rotate(10 225 85)">
            <rect x="180" y="24" width="90" height="124" rx="11"
              fill="currentColor" fillOpacity=".10" strokeWidth="1.2" opacity=".62" />
            <rect x="206" y="17" width="38" height="16" rx="6"
              fill="currentColor" fillOpacity=".24" strokeWidth="1" />
            {([54,76,98,120] as number[]).map(y =>
              <g key={y}>
                <rect x="192" y={y} width="13" height="13" rx="3.5" strokeWidth="1" opacity=".60" />
                <path d={`m194 ${y+6.5} 3.5 3.5 6.5-7.5m11 1.5h38m-38 6h28`}
                  strokeWidth="1" opacity=".60" />
              </g>)}
            {/* progress bar */}
            <rect x="192" y="142" width="66" height="5" rx="2.5"
              fill="currentColor" fillOpacity=".12" strokeWidth=".8" />
            <rect x="192" y="142" width="40" height="5" rx="2.5"
              fill="currentColor" fillOpacity=".45" stroke="none" />
          </g>

          {/* PRIMARY — clock face */}
          <circle cx="265" cy="128" r="28"
            fill="currentColor" fillOpacity=".12" strokeWidth="1.8" opacity=".78" />
          <circle cx="265" cy="128" r="2.8" fill="currentColor" stroke="none" opacity=".85" />
          <path strokeWidth="2.2" opacity=".80" d="M265 110v18l12 7" />
          {/* clock tick marks */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 - 90) * Math.PI / 180;
            const r1 = 24, r2 = i % 3 === 0 ? 20 : 22;
            return <line key={i}
              x1={265 + r1 * Math.cos(a)} y1={128 + r1 * Math.sin(a)}
              x2={265 + r2 * Math.cos(a)} y2={128 + r2 * Math.sin(a)}
              strokeWidth={i % 3 === 0 ? 1.6 : 0.8}
              opacity={i % 3 === 0 ? .72 : .38} />;
          })}

          {/* PRIMARY — bar chart columns */}
          <path strokeWidth="1.3" opacity=".50"
            d="M122 150 L122 130 M134 150 L134 118 M146 150 L146 136
               M158 150 L158 110 M170 150 L170 125" />
          <path opacity=".28" strokeWidth=".8" d="M118 150 h58" />

          {/* PRIMARY — trend line + arrowhead */}
          <path strokeWidth="2" opacity=".72"
            d="M122 130 L134 118 L146 136 L158 110 L170 125" />
          <path fill="currentColor" fillOpacity=".65" stroke="none" opacity=".72"
            d="m167 110 9-4-4 9Z" />

          {/* SECONDARY — sparkles */}
          <path strokeWidth=".9" opacity=".48" d="m150 52 2 5 5 2-5 2-2 5-2-5-5-2 5-2" />
          <path strokeWidth=".8" opacity=".35" d="m284 22 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5" />
        </>}

      </svg>
    </span>
  );
}
