// scripts/renameBuild.js
const fse = require('fs-extra');
const path = require('path');

async function main() {
  // e.g. "desktop" or "mobile"
  const targetType = process.argv[2];
  // We'll move the build folder to build-desktop or build-mobile
  const targetDir = `build-${targetType}`;

  try {
    // Remove any existing target folder
    await fse.remove(targetDir);
    // Move the newly created build/ folder to build-desktop or build-mobile
    await fse.move('build', targetDir);
    console.log(`Moved build/ to ${targetDir}/`);
  } catch (err) {
    console.error('Error renaming build folder:', err);
    process.exit(1);
  }
}

main();
