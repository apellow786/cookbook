import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const label = 'com.apellow.cookbook-auto-publish';
const agents = path.join(os.homedir(), 'Library/LaunchAgents');
const state = path.join(root, '.auto-publish');
const plist = path.join(agents, `${label}.plist`);
const domain = `gui/${process.getuid()}`;
fs.mkdirSync(state, { recursive: true });
fs.mkdirSync(agents, { recursive: true });
try { execFileSync('/bin/launchctl', ['bootout', `${domain}/${label}`], { stdio: 'ignore' }); } catch {}
if (process.argv.includes('--uninstall')) {
  fs.rmSync(plist, { force: true });
  console.log('Automatic recipe publishing stopped and removed.');
} else {
  const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root, 'scripts/auto-publish.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${xml(path.join(state, 'watcher.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(state, 'watcher-error.log'))}</string>
</dict></plist>
`);
  execFileSync('/bin/launchctl', ['bootstrap', domain, plist], { stdio: 'inherit' });
  console.log(`Automatic recipe publishing enabled. Logs: ${state}/watcher.log`);
}
