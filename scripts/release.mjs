// npm run release — tags the current commit as v<package.json version> and pushes it.
// The tag triggers .github/workflows/release.yml, which builds the installer and publishes the GitHub Release.
// A version with a suffix (0.3.0-beta.1) becomes a pre-release.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

if (run('git status --porcelain')) throw new Error('Working tree is not clean: commit first.');
// a release is tagged from main (a feature release, after its PR merged) or from a patch branch (cut from the last tag), exactly as on GitHub
const branch = run('git rev-parse --abbrev-ref HEAD');
if (!/^(main|patch\/\d+\.\d+\.\d+)$/.test(branch)) throw new Error(`Release from main or a patch/x.y.z branch, not "${branch}".`);
run('git fetch -q origin');
if (run('git rev-parse HEAD') !== run(`git rev-parse origin/${branch}`)) throw new Error(`${branch} differs from origin/${branch}: pull or push first.`);
if (run('git tag --list ' + tag)) throw new Error(`${tag} already exists: bump "version" in package.json first.`);
run('git push origin HEAD');
run(`git tag -a ${tag} -m "Last Bastion ${tag}"`);
run(`git push origin ${tag}`);
console.log(`${tag} pushed. Watch the build:  gh run watch  ·  https://github.com/Cyanida/last-bastion/actions`);
