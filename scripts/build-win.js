const { execSync } = require('child_process');
const rcedit = require('rcedit');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const exePath = path.join(rootDir, 'release/win-unpacked/Open Wispr.exe');
const iconPath = path.join(rootDir, 'assets/windows/icon.ico');

async function build() {
  try {
    // Step 1: Run the normal build (without icon editing due to Windows symlink issues)
    console.log('Step 1: Building app...');
    execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

    // Step 2: Embed the icon using rcedit
    console.log('\nStep 2: Embedding icon...');
    await rcedit(exePath, { icon: iconPath });
    console.log('Icon embedded successfully!');

    // Step 3: Rebuild installers with the icon-embedded executable
    console.log('\nStep 3: Rebuilding installers...');
    execSync('npx electron-builder --win nsis --win portable --prepackaged release/win-unpacked', {
      stdio: 'inherit',
      cwd: rootDir
    });

    console.log('\nBuild complete! Installers are in the release folder.');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
