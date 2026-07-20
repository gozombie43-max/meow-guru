const fs = require('fs');

let content = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

// 1. Replace PlaylistThumbnail and PlaylistCard components
const oldComponentsRegex = /function PlaylistThumbnail\([\s\S]*?export default function VideosPage/m;

const newComponents = `function PlaylistThumbnail({ playlist }: { playlist: Playlist }) {
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
        <div className="lesson-badge">
          <span className="lesson-badge-compact">{playlist.lessons} videos</span>
        </div>
        <div className="play-affordance" aria-hidden="true">
          <PlayCircle size={32} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const openPlaylist = () => {
    if (playlist.href) {
      window.location.href = playlist.href;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!playlist.href) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPlaylist();
    }
  };

  return (
    <article
      className={\`playlist-card\${playlist.href ? " is-clickable" : ""}\`}
      onClick={openPlaylist}
      onKeyDown={handleKeyDown}
      tabIndex={playlist.href ? 0 : undefined}
      role={playlist.href ? "link" : undefined}
      aria-label={playlist.href ? \`Open \${playlist.title}\` : undefined}
    >
      <PlaylistThumbnail playlist={playlist} />

      <div className="playlist-meta-row">
        <div className="channel-logo">{playlist.logo}</div>
        <div className="playlist-copy">
          <h2 title={playlist.title}>{playlist.title}</h2>
          <p title={playlist.primary} className="meta-primary">{playlist.primary}</p>
          <p title={playlist.channel} className="meta-channel">{playlist.channel}</p>
        </div>
        <button
          type="button"
          className="more-btn"
          aria-label={\`More options for \${playlist.title}\`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical size={20} strokeWidth={2.8} />
        </button>
      </div>
    </article>
  );
}

export default function VideosPage`;

content = content.replace(oldComponentsRegex, newComponents);

// 2. We must fix CSS for the new structure
const cssReplacementScript = `
        .playlist-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          padding: 24px 10px 18px;
        }

        .playlist-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0;
          background: transparent;
          border: none;
          box-shadow: none;
          border-radius: 0;
        }

        body.theme-dark .playlist-card {
          background: transparent;
          border: none;
        }

        .playlist-thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 12px;
          overflow: hidden;
          background: #333; /* Fallback */
        }
        
        /* Gradients for themes */
        .theme-yellow { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .theme-green { background: linear-gradient(135deg, #10b981, #059669); }
        .theme-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .theme-purple { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }

        .thumb-stage {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          position: relative;
        }

        .thumb-icon {
          color: rgba(255, 255, 255, 0.95);
        }

        .lesson-badge {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 0.75rem;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .play-affordance {
          position: absolute;
          z-index: 4;
          right: 50%;
          top: 50%;
          transform: translate(50%, -50%);
          width: 44px;
          height: 44px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.42);
          opacity: 0;
          transition: opacity 0.18s ease;
          pointer-events: none;
        }

        .playlist-card:hover .play-affordance {
          opacity: 1;
        }

        .playlist-meta-row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) 24px;
          gap: 8px;
          align-items: start;
        }

        .channel-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #475569;
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 0.7rem;
          font-weight: bold;
          margin-top: 2px;
        }

        .playlist-copy {
          min-width: 0;
        }

        .playlist-copy h2 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1.2;
          color: var(--video-title-fg);
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .meta-primary, .meta-channel {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: var(--video-muted-fg);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .more-btn {
          background: transparent;
          border: none;
          color: var(--video-more-fg);
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 2px 0;
        }
`;

// Replace the entire <style> block from `.playlist-list` down to the first `@media (min-width: 768px)`
// Wait, the easiest is to just wipe the old .playlist-list through .empty-state and replace.

const oldCssRegex = /\.playlist-list \{[\s\S]*?\.empty-state p \{\s*margin: 0;\s*\}/;
content = content.replace(oldCssRegex, cssReplacementScript + '\n        .empty-state { min-height: 220px; display: grid; place-items: center; color: var(--video-empty-fg); }\n        .empty-state p { margin: 0; }');

// We also need to fix the @media queries at the bottom which had overrides for the old layout.
// Since our new CSS is perfectly responsive (using grid), we can just remove the old specific overrides.
const desktopOverrideRegex = /\.playlist-list \{\s*display: grid;\s*grid-template-columns: repeat\(auto-fill, minmax\(280px, 1fr\)\);\s*gap: 20px;\s*padding-top: 48px;\s*\}/;
content = content.replace(desktopOverrideRegex, '.playlist-list { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; padding: 24px 0; }');

// Mobile specific overrides in @media (max-width: 390px)
const mobileOverrideRegex = /\.playlist-list \{\s*padding-top: 22px;\s*gap: 28px;\s*\}/;
content = content.replace(mobileOverrideRegex, ''); // Remove it, we handle it in base

fs.writeFileSync('frontend/app/videos/page.tsx', content);
console.log('Videos structural redesign script successful!');
