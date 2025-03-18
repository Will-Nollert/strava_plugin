const fs = require('fs');
const path = require('path');
const ChromeExtension = require('crx');
const manifest = require('../dist/manifest.json');

// Set up the extension path
const extensionPath = path.join(__dirname, '../dist');
const outputPath = path.join(__dirname, '../builds');

// Ensure the output directory exists
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

// Get the private key
const keyPath = process.env.EXTENSION_KEY_PATH || path.join(__dirname, '../key.pem');
let privateKey;

try {
  if (fs.existsSync(keyPath)) {
    privateKey = fs.readFileSync(keyPath);
  } else {
    console.log('No existing key found, a new one will be created');
  }
} catch (err) {
  console.error('Error reading private key:', err);
  process.exit(1);
}

// Create a new Chrome Extension object
const crx = new ChromeExtension({
  privateKey: privateKey
});

// Build the .crx package
async function build() {
  try {
    // Load the extension
    await crx.load(extensionPath);
    
    // Generate a new key if needed
    if (!privateKey) {
      const newKey = await crx.generateKey();
      fs.writeFileSync(keyPath, newKey.private);
      console.log('Generated new private key');
    }
    
    // Pack the extension
    const crxBuffer = await crx.pack();
    
    // Generate .crx filename
    const crxName = `${manifest.name.replace(/\s/g, '_')}-v${manifest.version}.crx`;
    const crxPath = path.join(outputPath, crxName);
    
    // Write the .crx file
    fs.writeFileSync(crxPath, crxBuffer);
    console.log(`Created extension: ${crxPath}`);
    
    // Also save the public key for update manifest
    const updateXmlPath = path.join(outputPath, 'update.xml');
    const publicKey = await crx.generateAppId();
    
    // Create update XML (for self-hosting auto-updates)
    const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${publicKey}'>
    <updatecheck codebase='https://your-host-url.com/${crxName}' version='${manifest.version}' />
  </app>
</gupdate>`;
    
    fs.writeFileSync(updateXmlPath, updateXml);
    console.log(`Created update manifest: ${updateXmlPath}`);
    
  } catch (err) {
    console.error('Error creating .crx package:', err);
    process.exit(1);
  }
}

build();