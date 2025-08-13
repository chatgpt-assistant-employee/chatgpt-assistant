const sharp = require('sharp');
const fs    = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../public/avatars/');
const OUT_DIR = path.resolve(__dirname, '../public/avatars/');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });


const AVATARS = ['avatar1.png','avatar2.png', 'avatar3.png', 'avatar4.png', 'avatar5.png', 'avatar6.png', 'avatar7.png'];
const SIZES   = [72, 98, 130, 180];

(async () => {
  for (const file of AVATARS) {
    const name = path.basename(file, '.png');
    for (const size of SIZES) {
      const inPath  = path.join(SRC_DIR, file);
      const outPath = path.join(OUT_DIR, `${name}-${size}.png`);
      await sharp(inPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(outPath);
      console.log(`✅ ${name}-${size}.png`);
    }
  }
  console.log('All done!');
})();