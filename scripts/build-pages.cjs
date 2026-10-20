const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'work', 'pages');

function releaseApp(source) {
  const start = source.indexOf('  function createDebugTools()');
  const end = source.indexOf('  /* Initialize */', start);
  if (start < 0 || end < 0) throw Error('Debug code boundaries not found');
  source = source.slice(0, start) + source.slice(end);
  const initialize = source.indexOf('  /* Initialize */');
  const boot = source.indexOf('  syncViewportHeight();', initialize);
  source = source.slice(0, initialize) + '  /* Initialize */\n' + source.slice(boot);
  source = source.replace(/^.*let debug(?:Progress|Sandbox) = null;.*\n/gm, '')
    .replace(/^.*if \(debugSandbox.*\n/gm, '')
    .replace(/^.*if \(debugProgress.*\n/gm, '')
    .replace(/^.*document.querySelector\('\.debug-panel\[open\]'\).*\n/gm, '')
    .replace(', .debug-panel', '');
  if (/debugSandbox|debugProgress|createDebugTools|vocx-debug/.test(source)) throw Error('Debug code remains in release');
  new vm.Script(source);
  return source;
}

function buildPages() {
  if (!output.startsWith(root + path.sep) || path.relative(root, output) !== path.join('work', 'pages')) throw Error('Invalid output directory');
  fs.rmSync(output, {recursive: true, force: true});
  fs.mkdirSync(output, {recursive: true});
  const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  const write = (file, text) => fs.writeFileSync(path.join(output, file), text);
  write('index.html', read('index.html').replace(/  <!-- Development only:[^\n]*\n/, '').replace(/  <script src="\.\/debug.js"><\/script>\n/, ''));
  write('app.js', releaseApp(read('app.js')));
  write('sw.js', read('sw.js').replace(/pwa-v(\d+)/, 'pwa-v$1-release').replace(/  '\.\/debug.js',\n/, ''));
  for (const file of ['ui.css', 'data.js', 'tango.js', 'dojo-exam.js', 'manifest.json']) fs.copyFileSync(path.join(root, file), path.join(output, file));
  const assets = [
    'sys/icon.svg', 'sys/icon-192.png', 'sys/icon-512.png', 'sys/apple-touch-icon.png',
    'sys/mode-jp-en.png', 'sys/mode-en-en.png',
    'sys/fonts/noto-sans-indic-siyaq-numbers.ttf', 'sys/fonts/Noto-Sans-Indic-Siyaq-Numbers-OFL.txt',
    'se/button.wav', 'se/Slide.wav', 'se/correct.wav', 'se/incorrect.wav',
    'se/countdown.wav', 'se/countdown-start.wav'
  ];
  for (const asset of assets) {
    fs.mkdirSync(path.dirname(path.join(output, asset)), {recursive: true});
    fs.copyFileSync(path.join(root, asset), path.join(output, asset));
  }
  for (const folder of ['vocx', 'dojo']) {
    const copy = (relative) => {
      const from = path.join(root, relative), to = path.join(output, relative);
      if (fs.statSync(from).isDirectory()) {
        fs.mkdirSync(to, {recursive: true});
        for (const file of fs.readdirSync(from)) copy(path.join(relative, file));
      } else if (/\.(?:csv|json)$/i.test(relative)) fs.copyFileSync(from, to);
    };
    copy(folder);
  }
  write('.nojekyll', '');
  return output;
}

if (require.main === module) console.log('GitHub Pages release built: ' + buildPages());
module.exports = {buildPages, releaseApp};
