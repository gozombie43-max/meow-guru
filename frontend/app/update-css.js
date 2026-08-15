const fs = require('fs');

let content = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

const macosCSS = `

        /* --- macOS Window Styles --- */
        .videos-page {
          min-height: 100vh;
          background: var(--video-page-bg, #f5f5f7);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .videos-header-mobile {
          display: none;
        }

        .macos-window {
          display: flex;
          width: 100%;
          height: 100vh;
          background: transparent;
        }

        .macos-sidebar {
          display: flex;
          flex-direction: column;
        }

        .macos-traffic-lights {
          display: none;
        }

        .macos-content {
          flex: 1;
          overflow-y: auto;
          background: var(--video-page-bg, #f5f5f7);
        }

        .sidebar-title {
          display: none;
        }

        @media (max-width: 767px) {
          .macos-window {
            flex-direction: column;
          }
          .macos-sidebar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: var(--video-header-bg, #ffffff);
            backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
            -webkit-backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
            border-bottom: 1px solid var(--video-header-border, transparent);
            padding: 16px 0 8px;
          }
          .videos-header-mobile {
            display: block;
            padding: 16px 20px 0;
          }
          .videos-header-mobile .header-title {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: var(--video-page-fg);
            margin: 0;
          }
          .sidebar-content {
             display: flex;
             align-items: center;
          }
        }

        @media (min-width: 768px) {
          .videos-page {
            padding: 40px;
            background: url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2940&auto=format&fit=crop') no-repeat center center / cover;
          }

          body.theme-dark .videos-page {
            background: url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2940&auto=format&fit=crop') no-repeat center center / cover;
          }

          .macos-window {
            max-width: 1200px;
            width: 100%;
            height: calc(100vh - 80px);
            max-height: 800px;
            background: var(--macos-window-bg, rgba(255, 255, 255, 0.8));
            backdrop-filter: blur(40px) saturate(150%);
            -webkit-backdrop-filter: blur(40px) saturate(150%);
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.2) inset;
            overflow: hidden;
            display: flex;
            flex-direction: row;
          }

          body.theme-dark .macos-window {
            --macos-window-bg: rgba(30, 30, 30, 0.75);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
          }

          .macos-sidebar {
            width: 240px;
            background: var(--macos-sidebar-bg, rgba(245, 245, 247, 0.5));
            border-right: 1px solid var(--macos-border, rgba(0,0,0,0.1));
            display: flex;
            flex-direction: column;
            padding: 16px 12px;
          }

          body.theme-dark .macos-sidebar {
            --macos-sidebar-bg: rgba(40, 40, 40, 0.5);
            --macos-border: rgba(255,255,255,0.1);
          }

          .macos-traffic-lights {
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
            padding-left: 8px;
          }

          .traffic-light {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }

          .traffic-light.close { background: #ff5f56; border: 1px solid #e0443e; }
          .traffic-light.minimize { background: #ffbd2e; border: 1px solid #dea123; }
          .traffic-light.maximize { background: #27c93f; border: 1px solid #1aab29; }

          .sidebar-title {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--video-muted-fg);
            margin: 0 0 8px 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .macos-content {
            flex: 1;
            padding: 32px;
            background: transparent;
            overflow-y: auto;
          }

          .videos-header-mobile {
            display: block;
            margin-bottom: 24px;
          }

          .videos-header-mobile .header-title {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: var(--video-page-fg);
            margin: 0;
          }

          .video-filters {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            padding: 0;
            gap: 4px;
            overflow: visible;
          }

          .video-chip {
            text-align: left;
            padding: 8px 12px;
            border-radius: 6px;
            min-height: 0;
            background: transparent;
            border: none;
            box-shadow: none;
            font-weight: 500;
            font-size: 0.95rem;
          }

          .video-chip.is-active {
            background: var(--macos-active-bg, rgba(0, 0, 0, 0.08));
            color: var(--video-page-fg);
            box-shadow: none;
          }

          body.theme-dark .video-chip.is-active {
            --macos-active-bg: rgba(255, 255, 255, 0.15);
          }

          .playlist-list {
            padding: 0;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 24px;
          }
        }
`;

content = content.replace('`}</style>', macosCSS + '\n      `}</style>');

fs.writeFileSync('frontend/app/videos/page.tsx', content);
console.log('CSS updated successfully.');
