const fs = require('fs');
let content = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

// 1. Revert PlaylistThumbnail
const oldThumbRegex = /function PlaylistThumbnail\([\s\S]*?function PlaylistCard/m;
const newThumbStr = `function PlaylistThumbnail({ playlist }: { playlist: Playlist }) {
  return (
    <div
      className={\`playlist-thumb theme-\${playlist.theme}\`}
      data-subject={playlist.icon}
      style={{ "--thumb-accent": playlist.accent } as CSSProperties}
    >
      <div className="thumb-stage">
        <div className="thumb-icon" aria-hidden="true">
          <SubjectIcon icon={playlist.icon} />
        </div>
      </div>
      <div className="lesson-badge">
        <span className="lesson-badge-compact">{playlist.lessons} videos</span>
      </div>
      <div className="play-affordance" aria-hidden="true">
        <PlayCircle size={32} strokeWidth={2.2} />
      </div>
    </div>
  );
}

function PlaylistCard`;
content = content.replace(oldThumbRegex, newThumbStr);

// 2. Add the proper iOS dark theme variables to the bottom of the style tag
const darkThemeCSS = `
        body.theme-dark {
          background: #000000;
        }

        body.theme-dark .videos-page {
          --video-page-bg: #000000;
          --video-page-fg: #ffffff;
          --video-title-fg: #ffffff;
          --video-muted-fg: rgba(235, 235, 245, 0.6);
          --video-more-fg: #ffffff;
          --video-empty-fg: rgba(235, 235, 245, 0.6);
          --video-filter-bg: rgba(0, 0, 0, 0.72);
          --video-filter-shadow: none;
          --video-filter-backdrop: blur(20px) saturate(180%);
          --video-chip-bg: rgba(255, 255, 255, 0.08);
          --video-chip-fg: rgba(235, 235, 245, 0.6);
          --video-chip-border: rgba(255, 255, 255, 0.08);
          --video-chip-active-bg: #ffffff;
          --video-chip-active-fg: #000000;
          --video-chip-active-border: #ffffff;
          --video-chip-press-bg: rgba(255, 255, 255, 0.12);
          --video-chip-active-press-bg: #e5e5ea;
        }

        body.theme-dark .playlist-card {
          background: transparent;
          border: none;
        }

        body.theme-dark .channel-logo {
          background: #2c2c2e;
          color: #fff;
        }
`;

// Insert right before the closing `}</style>`
content = content.replace(/\s*`\}\<\/style\>/, `\n${darkThemeCSS}\n      \`}</style>`);

fs.writeFileSync('frontend/app/videos/page.tsx', content);
console.log('Fixed dark theme text and reverted thumbnails!');
