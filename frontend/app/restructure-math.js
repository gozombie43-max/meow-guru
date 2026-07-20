const fs = require('fs');

const mathTopicsData = `  {
    title: "Arithmetic",
    subtitle: "Percentages, ratio, profit-loss, SI-CI, time-work",
    slug: "arithmetic",
    thumbnail:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Algebra",
    subtitle: "Equations, identities, polynomials and simplification",
    slug: "algebra",
    thumbnail:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Geometry",
    subtitle: "Angles, triangles, circles and theorem-based problems",
    slug: "geometry",
    thumbnail:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Mensuration",
    subtitle: "Area, perimeter, TSA, CSA and volume of solids",
    slug: "mensuration",
    thumbnail:
      "https://images.unsplash.com/photo-1453733190371-0a9bedd82893?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Trigonometry",
    subtitle: "Ratios, identities, heights and distances practice",
    slug: "trigonometry",
    thumbnail:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Statistics & Probability",
    subtitle: "Mean, median, mode, DI and probability rules",
    slug: "statistics-probability",
    thumbnail:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=200&q=80",
  },
  {
    title: "Number System",
    subtitle: "HCF, LCM, divisibility, primes and base concepts",
    slug: "number-system",
    thumbnail:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=200&q=80",
  },`;

const gaPageContent = fs.readFileSync('frontend/app/general-awareness/page.tsx', 'utf8');

let mathPageContent = gaPageContent
  .replace(/GeneralAwarenessPage/g, 'MathematicsPage')
  .replace(/general-awareness/g, 'mathematics')
  .replace(/gaTopics/g, 'mathTopics')
  .replace(/ga-topics-page/g, 'math-topics-page')
  .replace(/ga-header/g, 'math-header')
  .replace(/--ga-accent/g, '--math-accent')
  .replace(/--ga-border/g, '--math-border')
  .replace(/--ga-surface/g, '--math-surface')
  .replace(/--ga-ink/g, '--math-ink')
  .replace(/--ga-subink/g, '--math-subink')
  .replace(/General Awareness Topics/g, 'Mathematics Topics');

// Now replace the topics array data
mathPageContent = mathPageContent.replace(
  /const mathTopics: TopicItem\[\] = \[([\s\S]*?)\];/,
  `const mathTopics: TopicItem[] = [\n${mathTopicsData}\n];`
);

fs.writeFileSync('frontend/app/mathematics/page.tsx', mathPageContent);
console.log('Mathematics page completely restyled like GA!');
