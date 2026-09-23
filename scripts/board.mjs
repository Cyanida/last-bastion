// The tracking protocol (ROADMAP.md): the "Last Bastion Roadmap" Project board and the pinned "🔨 Now building" status issue.
//
//   node scripts/board.mjs add <issue> --version "v0.7.0 – Relic rework" --track "A (relics)" --size M --status Ready
//   node scripts/board.mjs set <issue> <Status>              Backlog | Ready | In progress | In review | Done | Blocked
//   node scripts/board.mjs start <issue> "<2-4 line plan>"   In progress, assigned, "Started" comment, status issue rewritten
//   node scripts/board.mjs finish <issue> <comment-file>     comment, Done, closed, status issue rewritten
//   node scripts/board.mjs status [--a "..."] [--b "..."] [--tests "..."] [--release "..."]
//
// The status issue is rebuilt from the board (what is In progress, the next Ready item per track, what closed today, what is Blocked);
// the free-text lines (--a, --b, --tests, --release) are kept from the current body unless given, so the two tracks never overwrite
// each other's line. ponytail: two writers within the same second can still race; the next write repairs it.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OWNER = 'Cyanida';
const REPO = 'Cyanida/last-bastion';
const PROJECT = 'Last Bastion Roadmap';
const STATUS_TITLE = '🔨 Now building';
const TRACKS = { A: 'A (relics)', B: 'B (music and convenience)' };

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
function gql(query, variables = {}) {
  const out = execFileSync('gh', ['api', 'graphql', '--input', '-'], { input: JSON.stringify({ query, variables }), encoding: 'utf8', maxBuffer: 64 << 20 });
  const data = JSON.parse(out);
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}
const tmp = (text) => {
  const f = join(mkdtempSync(join(tmpdir(), 'board-')), 'body.md');
  writeFileSync(f, text, 'utf8');
  return f;
};
const flag = (args, name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function project() {
  const d = gql(`query($login:String!){ user(login:$login){ projectsV2(first:50){ nodes{ id title url
    fields(first:50){ nodes{ ... on ProjectV2SingleSelectField { id name options{ id name } } } } } } } }`, { login: OWNER });
  const p = d.user.projectsV2.nodes.find((n) => n.title === PROJECT);
  if (!p) throw new Error(`no project "${PROJECT}"`);
  const fields = Object.fromEntries(p.fields.nodes.filter((f) => f.name).map((f) => [f.name, f]));
  return { ...p, fields };
}

/** Every item on the board with its issue and single-select values. */
function items(p) {
  const out = [];
  let after = null;
  do {
    const d = gql(`query($id:ID!,$after:String){ node(id:$id){ ... on ProjectV2 { items(first:100, after:$after){ pageInfo{ hasNextPage endCursor }
      nodes{ id content{ ... on Issue { number title state closedAt url labels(first:20){ nodes{ name } } } }
        fieldValues(first:20){ nodes{ ... on ProjectV2ItemFieldSingleSelectValue { name field{ ... on ProjectV2SingleSelectField { name } } } } } } } } } }`, { id: p.id, after });
    const page = d.node.items;
    for (const n of page.nodes) {
      if (!n.content?.number) continue;
      const values = Object.fromEntries(n.fieldValues.nodes.filter((v) => v.field).map((v) => [v.field.name, v.name]));
      out.push({ itemId: n.id, ...n.content, labels: n.content.labels.nodes.map((l) => l.name), ...values });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
}

function itemFor(p, issue) {
  const found = items(p).find((i) => i.number === issue);
  if (found) return found.itemId;
  const node = JSON.parse(gh('api', `repos/${REPO}/issues/${issue}`)).node_id;
  return gql('mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p, contentId:$c}){ item{ id } } }', { p: p.id, c: node }).addProjectV2ItemById.item.id;
}

function setField(p, itemId, field, value) {
  const f = p.fields[field];
  const option = f?.options.find((o) => o.name === value);
  if (!option) throw new Error(`no option "${value}" in field "${field}"`);
  gql('mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p, itemId:$i, fieldId:$f, value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }', { p: p.id, i: itemId, f: f.id, o: option.id });
}

function statusIssue() {
  const list = JSON.parse(gh('issue', 'list', '--repo', REPO, '--state', 'open', '--search', `"${STATUS_TITLE}" in:title`, '--json', 'number,title,body'));
  return list.find((i) => i.title === STATUS_TITLE);
}

const amsterdam = () => new Date().toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', dateStyle: 'medium', timeStyle: 'short' });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
const keep = (body, label) => body?.match(new RegExp(`\\*\\*${label.replace(/[()]/g, '\\$&')}:\\*\\* (.*)`))?.[1];

function writeStatus(args = []) {
  const p = project();
  const all = items(p);
  const issue = statusIssue();
  const body = issue?.body ?? '';
  const byNum = (a, b) => a.number - b.number;
  const line = (track, word) => {
    const now = all.filter((i) => i.Track === TRACKS[track] && i.Status === 'In progress').sort(byNum)[0];
    const next = all.filter((i) => i.Track === TRACKS[track] && i.Status === 'Ready' && i.state === 'OPEN').sort(byNum)[0];
    return word === 'now' ? now : next;
  };
  const nowLine = (track, label, text) => {
    const now = line(track, 'now');
    const old = keep(body, label)?.split(', ').slice(1).join(', ');
    return now ? `#${now.number} ${now.title}, ${text ?? old ?? 'starting'}` : 'nothing in progress';
  };
  const nextLine = (track) => {
    const next = line(track, 'next');
    return next ? `#${next.number} ${next.title}` : 'none';
  };
  const done = all.filter((i) => i.closedAt && new Date(i.closedAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }) === today()).sort(byNum).map((i) => `#${i.number}`);
  const blocked = all.filter((i) => i.Status === 'Blocked').sort(byNum).map((i) => `#${i.number} ${i.title}${i.labels.includes('question-for-jesse') ? ' (question for Jesse, see the issue)' : ''}`);
  const text = `**Last update:** ${amsterdam()}
**Release in progress:** ${flag(args, 'release') ?? keep(body, 'Release in progress') ?? 'v0.7.0 / v0.7.1'}

**Track A (relics), now:** ${nowLine('A', 'Track A (relics), now', flag(args, 'a'))}
**Track A, next:** ${nextLine('A')}
**Track B (music & convenience), now:** ${nowLine('B', 'Track B (music & convenience), now', flag(args, 'b'))}
**Track B, next:** ${nextLine('B')}

**Done today:** ${done.length ? done.join(', ') : 'nothing yet'}
**Blocked / waiting on Jesse:** ${blocked.length ? blocked.join('; ') : 'none'}
**Test status:** ${flag(args, 'tests') ?? keep(body, 'Test status') ?? 'unit -, perf -, build -'}
${flag(args, 'note') ? `\n${flag(args, 'note')}\n` : ''}
<sub>Written by \`node scripts/board.mjs status\` from the [Project board](${p.url}). Only comments by @${OWNER} are acted on.</sub>
`;
  if (issue) gh('issue', 'edit', String(issue.number), '--repo', REPO, '--body-file', tmp(text));
  else {
    const url = gh('issue', 'create', '--repo', REPO, '--title', STATUS_TITLE, '--label', 'area:tooling', '--body-file', tmp(text)).trim();
    gh('issue', 'pin', url);
  }
  console.log(text);
}

const [cmd, ...args] = process.argv.slice(2);
const n = Number(args[0]);
if (cmd === 'add') {
  const p = project();
  const item = itemFor(p, n);
  for (const field of ['Status', 'Version', 'Track', 'Size']) if (flag(args, field.toLowerCase())) setField(p, item, field, flag(args, field.toLowerCase()));
  console.log(`#${n} on the board`);
} else if (cmd === 'set') {
  const p = project();
  setField(p, itemFor(p, n), 'Status', args[1]);
  console.log(`#${n} -> ${args[1]}`);
} else if (cmd === 'start') {
  const p = project();
  setField(p, itemFor(p, n), 'Status', 'In progress');
  gh('issue', 'edit', String(n), '--repo', REPO, '--add-assignee', '@me');
  gh('issue', 'comment', String(n), '--repo', REPO, '--body-file', tmp(`Started\n\n${args[1] ?? ''}`));
  writeStatus(args.slice(2));
} else if (cmd === 'finish') {
  const p = project();
  gh('issue', 'comment', String(n), '--repo', REPO, '--body-file', args[1]);
  setField(p, itemFor(p, n), 'Status', 'Done');
  gh('issue', 'close', String(n), '--repo', REPO);
  writeStatus(args.slice(2));
} else if (cmd === 'status') {
  writeStatus(args);
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 9).join('\n'));
}
