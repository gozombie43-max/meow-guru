const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

const subjectSearch = `<div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobileView ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
                {SUBJECT_OPTIONS.map((subject) => {
                  const active = subjects.includes(subject.name);
                  return (
                    <button
                      key={subject.name}
                      type="button"
                      onClick={() => setSubjects((previous) => (active ? previous.filter((value) => value !== subject.name) : [...previous, subject.name]))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobileView ? 10 : 12,
                        width: '100%',
                        padding: isMobileView ? 10 : 12,
                        borderRadius: isMobileView ? 12 : 16,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: \`1px solid \${active ? (isDark ? 'rgba(83, 74, 183, 0.35)' : '#0a84ff') : 'var(--color-border-tertiary)'}\`,
                        background: active ? (isDark ? 'rgba(83, 74, 183, 0.18)' : '#f2f8ff') : (isDark ? 'rgba(15, 23, 42, 0.40)' : '#fbfbfd'),
                        color: 'var(--color-text-primary)',
                        boxShadow: active ? (isDark ? '0 12px 28px rgba(83, 74, 183, 0.12)' : '0 8px 18px rgba(10, 132, 255, 0.16)') : 'none',
                      }}
                    >
                      <div style={{ width: isMobileView ? 32 : 36, height: isMobileView ? 32 : 36, borderRadius: isMobileView ? 10 : 12, display: 'grid', placeItems: 'center', fontSize: isMobileView ? 14 : 16, background: subject.accent, flexShrink: 0 }}>{subject.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: isMobileView ? 14 : 15, fontWeight: 800 }}>{subject.name}</div>
                          <div style={{ width: 44, height: 26, borderRadius: 999, background: active ? '#34c759' : '#d1d1d6', border: '1px solid rgba(0,0,0,0.06)', position: 'relative', flexShrink: 0, transition: 'background 160ms ease' }}>
                            <div style={{ width: 22, height: 22, borderRadius: 999, background: '#ffffff', position: 'absolute', top: 1, left: active ? 21 : 1, transition: 'left 160ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.24)' }} />
                          </div>
                        </div>
                        {!isMobileView && <div className="subtext" style={{ marginTop: 4, fontSize: 12  }}>{subject.meta}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>`;

const subjectReplace = `<div className="macos-form-group">
                {SUBJECT_OPTIONS.map((subject) => {
                  const active = subjects.includes(subject.name);
                  return (
                    <div
                      key={subject.name}
                      className="macos-list-item"
                      onClick={() => setSubjects((previous) => (active ? previous.filter((value) => value !== subject.name) : [...previous, subject.name]))}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 16, background: subject.accent }}>{subject.icon}</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{subject.name}</div>
                          {!isMobileView && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{subject.meta}</div>}
                        </div>
                      </div>
                      <div className={\`macos-toggle \${active ? 'active' : ''}\`}>
                        <div className="macos-toggle-thumb" />
                      </div>
                    </div>
                  );
                })}
              </div>`;

content = content.replace(subjectSearch, subjectReplace);

const qCountSearch = `<div style={{ display: 'grid', gridTemplateColumns: isMobileView ? 'repeat(3, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: isMobileView ? 8 : 10 }}>
                {QUESTION_COUNT_OPTIONS.map((count) => {
                  const active = qCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQCount(count)}
                      style={{
                        ...actionButtonStyle,
                        padding: '10px 12px',
                        borderRadius: 14,
                        border: \`1px solid \${active ? (isDark ? 'rgba(83, 74, 183, 0.35)' : '#0a84ff') : 'var(--color-border-tertiary)'}\`,
                        background: active
                          ? (isDark ? 'rgba(83, 74, 183, 0.24)' : '#f2f8ff')
                          : (isDark ? 'rgba(15, 23, 42, 0.44)' : '#fbfbfd'),
                        color: 'var(--color-text-primary)',
                        boxShadow: active ? (isDark ? '0 12px 22px rgba(83, 74, 183, 0.14)' : '0 8px 16px rgba(10, 132, 255, 0.14)') : 'none',
                      }}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>`;

const qCountReplace = `<div className="macos-segmented-control">
                {QUESTION_COUNT_OPTIONS.map((count) => {
                  const active = qCount === count;
                  return (
                    <div
                      key={count}
                      className={\`macos-segmented-option \${active ? 'active' : ''}\`}
                      onClick={() => setQCount(count)}
                    >
                      {active && <div className="macos-segmented-highlight" />}
                      <span style={{ position: 'relative', zIndex: 2 }}>{count}</span>
                    </div>
                  );
                })}
              </div>`;

content = content.replace(qCountSearch, qCountReplace);

const modeSearch = `<div style={{ display: 'grid', gridTemplateColumns: isMobileView ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobileView ? 8 : 10 }}>
                {MODE_OPTIONS.map((item) => {
                  const active = mode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMode(item.value)}
                      style={{
                        ...actionButtonStyle,
                        textAlign: 'left',
                        padding: isMobileView ? '10px 12px' : '12px 14px',
                        background: active ? (isDark ? 'rgba(83, 74, 183, 0.20)' : '#f2f8ff') : (isDark ? 'rgba(15, 23, 42, 0.42)' : '#fbfbfd'),
                        color: 'var(--color-text-primary)',
                        border: \`1px solid \${active ? (isDark ? 'rgba(83, 74, 183, 0.30)' : '#0a84ff') : 'var(--color-border-tertiary)'}\`,
                        boxShadow: active ? (isDark ? '0 18px 34px rgba(83, 74, 183, 0.12)' : '0 10px 20px rgba(10, 132, 255, 0.15)') : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: item.accent, boxShadow: \`0 0 0 4px \${item.accent}\` }} />
                        <div style={{ fontSize: isMobileView ? 14 : 15, fontWeight: 800 }}>{item.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>`;

const modeReplace = `<div className="macos-segmented-control" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', display: 'grid', background: 'var(--seg-bg)' }}>
                {MODE_OPTIONS.map((item) => {
                  const active = mode === item.value;
                  return (
                    <div
                      key={item.value}
                      className={\`macos-segmented-option \${active ? 'active' : ''}\`}
                      onClick={() => setMode(item.value)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      {active && <div className="macos-segmented-highlight" />}
                      <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: item.accent }} />
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>`;

content = content.replace(modeSearch, modeReplace);

const excludeSearch = `<label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 700 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 44,
                      height: 26,
                      borderRadius: 999,
                      background: excludeOwn ? '#34c759' : '#d1d1d6',
                      border: '1px solid rgba(0,0,0,0.06)',
                      position: 'relative',
                      transition: 'background 160ms ease',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: '#ffffff', position: 'absolute', top: 1, left: excludeOwn ? 21 : 1, transition: 'left 160ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.24)' }} />
                  </div>
                  <input type="checkbox" checked={excludeOwn} onChange={(e) => setExcludeOwn(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
                  Exclude my own questions
                </label>`;

const excludeReplace = `<div className="macos-form-group" style={{ margin: 0, minWidth: 260 }}>
                  <div className="macos-list-item" onClick={() => setExcludeOwn(!excludeOwn)}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Exclude my own questions</div>
                    <div className={\`macos-toggle \${excludeOwn ? 'active' : ''}\`}>
                      <div className="macos-toggle-thumb" />
                    </div>
                  </div>
                </div>`;

content = content.replace(excludeSearch, excludeReplace);

fs.writeFileSync(file, content);
console.log('UI controls converted to macOS style.');
