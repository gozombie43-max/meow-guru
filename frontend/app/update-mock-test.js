const fs = require('fs');

let content = fs.readFileSync('frontend/app/mock-test/page.tsx', 'utf8');

// The original JSX structure we need to wrap:
// return (
//   <main className={styles.page}>
//     <div className={styles.app}>

const oldJsxStart = `  return (
    <main className={styles.page}>
      <div className={styles.app}>`;

const newJsxStart = `  return (
    <main className={styles.page}>
      <div className={styles.macosWindow}>
        {/* Desktop Sidebar */}
        <aside className={styles.macosSidebar}>
          <div className={styles.macosTrafficLights}>
            <div className={\`\${styles.trafficLight} \${styles.close}\`}></div>
            <div className={\`\${styles.trafficLight} \${styles.minimize}\`}></div>
            <div className={\`\${styles.trafficLight} \${styles.maximize}\`}></div>
          </div>
          
          <h2 className={styles.sidebarTitle}>Categories</h2>
          <div className={styles.sidebarNav}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={\`\${styles.sidebarTab} \${activeCategory === cat.id ? styles.activeSidebarTab : ''}\`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.emoji}</span> {cat.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className={styles.macosContent}>
          <div className={styles.app}>`;

content = content.replace(oldJsxStart, newJsxStart);

// At the end of the file, we need to close the two extra divs.
// It looks like:
//         )}
//       </div>
//     </main>
//   );
// }

const oldJsxEnd = `      </div>
    </main>
  );
}`;

const newJsxEnd = `          </div>
        </div>
      </div>
    </main>
  );
}`;

content = content.replace(oldJsxEnd, newJsxEnd);

fs.writeFileSync('frontend/app/mock-test/page.tsx', content);
console.log('page.tsx wrapped successfully.');
