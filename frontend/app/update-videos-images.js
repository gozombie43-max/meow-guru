const fs = require('fs');

let content = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

// 1. Add image to type Playlist
content = content.replace(/icon: "reasoning" \| "math" \| "english" \| "general-awareness";\s*\};/, `icon: "reasoning" | "math" | "english" | "general-awareness";\n  image?: string;\n};`);

// 2. Add images to playlists array
content = content.replace(/title: "Reasoning",[\s\S]*?icon: "reasoning",/g, (match) => {
  if (match.includes("SSC Pratham 11")) return match.replace(/icon: "reasoning",/, 'icon: "reasoning",\n    image: "/images/reasoning_thumb.jpg",');
  return match.replace(/icon: "reasoning",/, 'icon: "reasoning",\n    image: "/images/reasoning_thumb.jpg",');
});
content = content.replace(/title: "Math",[\s\S]*?icon: "math",/g, (match) => match.replace(/icon: "math",/, 'icon: "math",\n    image: "/images/math_thumb.jpg",'));
content = content.replace(/title: "English",[\s\S]*?icon: "english",/g, (match) => match.replace(/icon: "english",/, 'icon: "english",\n    image: "/images/english_thumb.jpg",'));
content = content.replace(/title: "General Awareness",[\s\S]*?icon: "general-awareness",/g, (match) => match.replace(/icon: "general-awareness",/, 'icon: "general-awareness",\n    image: "/images/ga_thumb.jpg",'));
content = content.replace(/title: "SSC Pratham 12",[\s\S]*?icon: "general-awareness",/g, (match) => match.replace(/icon: "general-awareness",/, 'icon: "general-awareness",\n    image: "/images/ga_thumb.jpg",'));
content = content.replace(/title: "Study With Guru",[\s\S]*?icon: "math",/g, (match) => match.replace(/icon: "math",/, 'icon: "math",\n    image: "/images/math_thumb.jpg",'));

// 3. Update PlaylistThumbnail
const oldThumbRegex = /function PlaylistThumbnail\([\s\S]*?export default function VideosPage/;
const newThumbStr = `function PlaylistThumbnail({ playlist }: { playlist: Playlist }) {
  return (
    <div
      className={\`playlist-thumb theme-\${playlist.theme}\`}
      data-subject={playlist.icon}
      style={{ "--thumb-accent": playlist.accent } as CSSProperties}
    >
      {playlist.image ? (
        <img src={playlist.image} alt={playlist.title} className="thumb-image" />
      ) : (
        <div className="thumb-stage">
          <div className="thumb-icon" aria-hidden="true">
            <SubjectIcon icon={playlist.icon} />
          </div>
        </div>
      )}
      <div className="lesson-badge">
        <span className="lesson-badge-compact">{playlist.lessons} videos</span>
      </div>
      <div className="play-affordance" aria-hidden="true">
        <PlayCircle size={32} strokeWidth={2.2} />
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
content = content.replace(oldThumbRegex, newThumbStr);


// 4. Update VideosPage header
const oldHeaderRegex = /<div className="videos-header">\s*<VideoFilters active={activeFilter} onChange={setActiveFilter} \/>\s*<\/div>/;
const newHeaderStr = `<div className="videos-header">
            <div className="header-top">
              <h1 className="header-title">Videos</h1>
            </div>
            <VideoFilters active={activeFilter} onChange={setActiveFilter} />
          </div>`;
content = content.replace(oldHeaderRegex, newHeaderStr);


// 5. Add CSS for image and header and update iOS dark theme for header
const cssAdditions = `
        .header-top {
          padding: 16px 20px 8px;
        }

        .header-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--video-page-fg);
          margin: 0;
        }

        .videos-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--video-header-bg, #ffffff);
          backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
          -webkit-backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
          border-bottom: 1px solid var(--video-header-border, transparent);
        }

        body.theme-dark .videos-header {
          --video-header-bg: rgba(0, 0, 0, 0.72);
          --video-header-border: rgba(255, 255, 255, 0.08);
        }

        .thumb-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        /* Adjust lesson badge z-index */
        .lesson-badge {
          z-index: 5;
        }
`;

// Insert the CSS additions right after the <style>{` tag
content = content.replace(/<style>\{`\s*/, `<style>{\`\n${cssAdditions}\n`);

// Finally, make sure the .videos-header that had sticky properties isn't duplicated
content = content.replace(/\.videos-header \{\s*position: sticky;[\s\S]*?\}\s*\.video-filters \{/, '.video-filters {');


fs.writeFileSync('frontend/app/videos/page.tsx', content);
console.log('Videos updated with images and iOS header!');
