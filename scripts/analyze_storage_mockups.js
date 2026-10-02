const fs = require('fs');
const path = require('path');

const storageObjects = JSON.parse(fs.readFileSync('scripts/all_storage_objects.json', 'utf8'));

const mockups = storageObjects.filter(f => f.startsWith('products/mockups/'));
const mockupThumbs = storageObjects.filter(f => f.startsWith('products/thumbnails/mockups/'));

console.log('Mockups count in storage:', mockups.length);
console.log('Mockup thumbnails count in storage:', mockupThumbs.length);

// Let's compare filenames of mockups vs thumbnails
const mockupBases = new Set(mockups.map(m => path.basename(m, path.extname(m))));
const thumbBases = new Set(mockupThumbs.map(t => path.basename(t, path.extname(t))));

console.log('Unique mockup basenames:', mockupBases.size);
console.log('Unique thumbnail basenames:', thumbBases.size);

// Are they 1-to-1?
let inBoth = 0;
let mockupWithoutThumb = [];
let thumbWithoutMockup = [];

mockupBases.forEach(b => {
  if (thumbBases.has(b)) inBoth++;
  else mockupWithoutThumb.push(b);
});

thumbBases.forEach(b => {
  if (!mockupBases.has(b)) thumbWithoutMockup.push(b);
});

console.log('Matching basenames in both:', inBoth);
console.log('Mockups without thumbnail:', mockupWithoutThumb.length);
if (mockupWithoutThumb.length > 0) console.log('Sample mockups without thumb:', mockupWithoutThumb.slice(0, 5));
console.log('Thumbnails without mockup:', thumbWithoutMockup.length);
if (thumbWithoutMockup.length > 0) console.log('Sample thumbs without mockup:', thumbWithoutMockup.slice(0, 5));
