const fs = require('fs');

const lightUrlOld = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2940&auto=format&fit=crop";
const darkUrlOld = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2940&auto=format&fit=crop";

const lightUrlNew = "https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2940&auto=format&fit=crop";
const darkUrlNew = "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2940&auto=format&fit=crop";

const files = [
  'frontend/app/videos/page.tsx',
  'frontend/app/play/play.css'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(new RegExp(lightUrlOld.replace('?', '\\?'), 'g'), lightUrlNew);
  content = content.replace(new RegExp(darkUrlOld.replace('?', '\\?'), 'g'), darkUrlNew);
  fs.writeFileSync(file, content);
}

console.log("Backgrounds updated successfully.");
