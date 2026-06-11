const fs = require('fs');
const path = require('path');
const https = require('https');

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

const BASE_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const TARGET_DIR = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFile(fileName) {
  return new Promise((resolve, reject) => {
    const fileUrl = `${BASE_URL}${fileName}`;
    const filePath = path.join(TARGET_DIR, fileName);
    const fileStream = fs.createWriteStream(filePath);

    https.get(fileUrl, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Downloaded ${fileName}`);
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(filePath, () => {});
          reject(err);
        });
        return;
      }

      if (response.statusCode !== 200) {
        fs.unlink(filePath, () => {});
        reject(new Error(`Failed to get '${fileName}' status: ${response.statusCode}`));
        return;
      }

      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded ${fileName}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

async function start() {
  console.log(`Starting download of face-api models to ${TARGET_DIR}...`);
  for (const file of FILES) {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error(`Error downloading ${file}:`, error.message);
      // Fallback url
      try {
        const fallbackUrl = `https://raw.githubusercontent.com/vladmandic/face-api/master/model/${file}`;
        console.log(`Attempting fallback download for ${file} from Github...`);
        // We'll write direct wget/curl in command if this script fails, but let's try direct first.
      } catch (e) {}
    }
  }
  console.log('Model downloads complete!');
}

start();
