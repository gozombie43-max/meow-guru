const fs = require('fs');
let code = fs.readFileSync('frontend/app/english/page.tsx', 'utf8');

// Update JSX structure
const jsxOld = `<div className="body">
        {/* ── Search ── */}
        <div className="search-row">
          <Search className="search-ico" size={16} />
          <input
            type="text"
            className="search-field"
            placeholder="Search topics or subtopics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search topics"
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear">
              ×
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="tabs-scroll">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={\`tab-btn\${activeTab === tab.id ? " tab-active" : ""}\`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Count row ── */}
        <div className="count-row">
          <span className="count-text">{filtered.length} topic{filtered.length !== 1 ? "s" : ""}</span>
          {(search || activeTab !== "all") && (
            <button className="clear-btn" onClick={() => { setSearch(""); setActiveTab("all"); }}>
              Clear filters
            </button>
          )}
        </div>

        {/* ── List ── */}
        {filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-ico">🔍</span>
            <p className="empty-title">No topics found</p>
            <p className="empty-sub">Try a different search term</p>
          </div>
        ) : (
          <div className="pill-list">
            {filtered.map((topic, i) => (
              <TopicPill key={topic.id} topic={topic} index={i} />
            ))}
          </div>
        )}
      </div>`;

const jsxNew = `<div className="body">
        <aside className="pc-sidebar">
          {/* ── Search ── */}
          <div className="search-row">
            <Search className="search-ico" size={16} />
            <input
              type="text"
              className="search-field"
              placeholder="Search topics or subtopics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search topics"
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear">
                ×
              </button>
            )}
          </div>

          {/* ── Tabs ── */}
          <div className="tabs-scroll">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={\`tab-btn\${activeTab === tab.id ? " tab-active" : ""}\`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="pc-main">
          {/* ── Count row ── */}
          <div className="count-row">
            <span className="count-text">{filtered.length} topic{filtered.length !== 1 ? "s" : ""}</span>
            {(search || activeTab !== "all") && (
              <button className="clear-btn" onClick={() => { setSearch(""); setActiveTab("all"); }}>
                Clear filters
              </button>
            )}
          </div>

          {/* ── List ── */}
          {filtered.length === 0 ? (
            <div className="empty">
              <span className="empty-ico">🔍</span>
              <p className="empty-title">No topics found</p>
              <p className="empty-sub">Try a different search term</p>
            </div>
          ) : (
            <div className="pill-list">
              {filtered.map((topic, i) => (
                <TopicPill key={topic.id} topic={topic} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>`;

code = code.replace(jsxOld, jsxNew);

// Add CSS media query for desktop
const styleInjection = `
        /* ── DESKTOP PC DESIGN (>= 768px) ── */
        @media (min-width: 768px) {
          .body {
            max-width: 1100px;
            display: grid;
            grid-template-columns: 240px 1fr;
            gap: 40px;
            padding: 40px 32px 80px;
          }

          .pc-sidebar {
            position: sticky;
            top: 96px;
            height: fit-content;
          }

          .tabs-scroll {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 16px;
            overflow: visible;
          }

          .tab-btn {
            height: 40px;
            border-radius: 8px;
            text-align: left;
            padding: 0 16px;
            width: 100%;
            justify-content: flex-start;
          }

          .pill-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
          }
          
          .pill-card {
            flex-direction: column;
            align-items: flex-start;
            padding: 18px 16px;
            border-radius: 20px;
            min-height: 120px;
          }

          .pill-icon {
            width: 48px;
            height: 48px;
            margin-bottom: 8px;
          }

          .pill-middle {
            width: 100%;
          }

          .pill-name {
            font-size: 1.1rem;
            margin-bottom: 4px;
          }

          .pill-badge {
            margin-top: auto;
            align-self: flex-start;
          }

          .topbar {
            height: 64px;
            padding: 0 40px;
          }
          
          .topbar-title {
            font-size: 1.1rem;
          }
        }
      \`}</style>
`;

code = code.replace(/      `\}<\/style>/, styleInjection);

fs.writeFileSync('frontend/app/english/page.tsx', code);
console.log('Successfully added PC layout.');
