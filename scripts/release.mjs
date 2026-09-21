// npm run release — tags the current commit as v<package.json version> and pushes it.
// The tag triggers .github/workflows/release.yml, which builds the installer and publishes the GitHub Release.
// A version with a suffix (0.3.0-beta.1) becomes a pre-release.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

if (run('git status --porcelain')) throw new Error('Working tree is not clean: commit first.');
if (run('git tag --list ' + tag)) throw new Error(`${tag} already exists: bump "version" in package.json first.`);
run('git push origin HEAD');
run(`git tag -a ${tag} -m "Last Bastion ${tag}"`);
run(`git push origin ${tag}`);
console.log(`${tag} pushed. Watch the build:  gh run watch  ·  https://github.com/Cyanida/last-bastion/actions`);
