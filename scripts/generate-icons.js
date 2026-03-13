// scripts/generate-icons.js
// Generates all required PWA icon sizes from src/img/icon.png
// Run: node scripts/generate-icons.js

const sharp = require('sharp');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const input = path.join(__dirname, '..', 'src', 'img', 'logo.png');
const outputDir = path.join(__dirname, '..', 'src', 'img');

async function generate() {
  console.log('Generating PWA icons from:', input);
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(input)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 15, alpha: 1 }
      })
      .toFile(outputPath);
    console.log(`✅ Generated icon-${size}.png`);
  }
  console.log('\n🎉 All icons generated in src/img/');
}

generate().catch((err) => {
  console.error('❌ Icon generation failed:', err.message);
  process.exit(1);
});
