#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Determine if we should use minified files
const useMinified = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
const suffix = useMinified ? '.min' : '';

console.log(`Building HTML files... (minified: ${useMinified})`);

// File mappings
const files = [
  'index.html',
  'bill.html', 
  'login.html',
  'register.html'
];

const replacements = [
  { from: 'styles.css', to: `styles${suffix}.css` },
  { from: 'script.js', to: `script${suffix}.js` },
  { from: 'result.css', to: `result${suffix}.css` },
  { from: 'result.js', to: `result${suffix}.js` },
  { from: 'login.css', to: `login${suffix}.css` },
  { from: 'login.js', to: `login${suffix}.js` }
];

files.forEach(filename => {
  const filePath = path.join(__dirname, 'public', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filename} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  replacements.forEach(({ from, to }) => {
    const fromPattern = new RegExp(`(['"])${from}\\1`, 'g');
    if (fromPattern.test(content)) {
      content = content.replace(fromPattern, `$1${to}$1`);
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filename} with${suffix ? ' minified' : ' regular'} file references`);
  }
});

console.log('HTML build complete!');