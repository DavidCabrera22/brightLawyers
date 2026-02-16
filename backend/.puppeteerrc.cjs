const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to be inside the project folder.
  // This ensures Render keeps the chrome binary between build and runtime.
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};
