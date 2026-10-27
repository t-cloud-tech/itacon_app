const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, '..', 'functions', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded ${path.basename(destPath)} (${fs.statSync(destPath).size} bytes)`);
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  const regularUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
  const boldUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

  await downloadFile(regularUrl, path.join(fontsDir, 'NotoSans-Regular.ttf'));
  await downloadFile(boldUrl, path.join(fontsDir, 'NotoSans-Bold.ttf'));
  console.log('Fonts downloaded successfully.');
}

main().catch(console.error);
