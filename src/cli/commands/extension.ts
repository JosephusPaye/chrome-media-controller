import fs from 'fs';
import path from 'path';

export function extension(extensionId: string) {
  const nativeManifestFile = path.resolve(
    __dirname,
    '..',
    '..',
    'host',
    'manifest.json'
  );

  const manifest = require(nativeManifestFile);

  const origin = `chrome-extension://${extensionId}/`;

  const origins = new Set(manifest.allowed_origins || []);
  origins.add(origin);

  manifest.allowed_origins = Array.from(origins);

  fs.writeFileSync(nativeManifestFile, JSON.stringify(manifest, null, '  '));

  console.log('extension allowed:', origin);
}
