const fs = require('fs');

let content = fs.readFileSync('frontend/app/mock-test/page.module.css', 'utf8');

const macosCSS = `
/* --- macOS Window Styles --- */

.macosWindow {
  display: block;
}

.macosSidebar {
  display: none;
}

.macosTrafficLights {
  display: none;
}

.sidebarTitle {
  display: none;
}

.sidebarNav {
  display: none;
}

.macosContent {
  width: 100%;
}

@media (min-width: 768px) {
  .page {
    padding: 40px;
    background: url('https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2940&auto=format&fit=crop') no-repeat center center / cover !important;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(body.theme-dark) .page {
    background: url('https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2940&auto=format&fit=crop') no-repeat center center / cover !important;
  }

  .macosWindow {
    width: 100%;
    max-width: 1200px;
    height: calc(100vh - 80px);
    max-height: 800px;
    display: flex;
    flex-direction: row;
    background: var(--macos-window-bg, rgba(255, 255, 255, 0.8));
    backdrop-filter: blur(40px) saturate(150%);
    -webkit-backdrop-filter: blur(40px) saturate(150%);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.2) inset;
    overflow: hidden;
  }

  :global(body.theme-dark) .macosWindow {
    --macos-window-bg: rgba(30, 30, 30, 0.75);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
  }

  .macosSidebar {
    display: flex;
    width: 240px;
    flex-direction: column;
    background: var(--macos-sidebar-bg, rgba(245, 245, 247, 0.5));
    border-right: 1px solid var(--border);
    padding: 16px 12px;
  }

  :global(body.theme-dark) .macosSidebar {
    --macos-sidebar-bg: rgba(40, 40, 40, 0.5);
    --border: rgba(255,255,255,0.1);
  }

  .macosTrafficLights {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    padding-left: 8px;
  }

  .trafficLight {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .close { background: #ff5f56; border: 1px solid #e0443e; }
  .minimize { background: #ffbd2e; border: 1px solid #dea123; }
  .maximize { background: #27c93f; border: 1px solid #1aab29; }

  .sidebarTitle {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0 0 8px 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sidebarNav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sidebarTab {
    text-align: left;
    padding: 8px 12px;
    border-radius: 6px;
    background: transparent;
    border: none;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-dark);
    cursor: pointer;
  }

  .sidebarTab.activeSidebarTab {
    background: var(--macos-active-bg, rgba(0,0,0,0.08));
  }

  :global(body.theme-dark) .sidebarTab.activeSidebarTab {
    --macos-active-bg: rgba(255,255,255,0.15);
  }

  .macosContent {
    flex: 1;
    overflow-y: auto;
    background: transparent;
  }

  /* Hide the mobile category scroll on desktop since it's now in the sidebar */
  .categoryScroll {
    display: none;
  }
}
`;

content = content + '\n' + macosCSS;

fs.writeFileSync('frontend/app/mock-test/page.module.css', content);
console.log('page.module.css updated successfully.');
