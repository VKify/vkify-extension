// GitHub Ubuntu runners may route apt through an unavailable Azure mirror.
// Keep the existing suites, components and signing keys; use Ubuntu's archive.
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
const directory = '/etc/apt/sources.list.d';
if (process.platform !== 'linux') throw new Error('This script is only for Ubuntu CI');
if (existsSync('/etc/apt/apt-mirrors.txt')) {
  writeFileSync('/etc/apt/apt-mirrors.txt', 'https://archive.ubuntu.com/ubuntu\nhttps://security.ubuntu.com/ubuntu\n');
}
const paths = ['/etc/apt/sources.list', ...readdirSync(directory).filter(name => /\.(sources|list)$/.test(name)).map(name => directory + '/' + name)];
for (const path of paths) {
  if (!existsSync(path)) continue;
  const source = readFileSync(path, 'utf8');
  const next = source.replace(/https?:[/][/]azure\.archive\.ubuntu\.com[/]ubuntu/g, 'https://archive.ubuntu.com/ubuntu');
  if (next !== source) writeFileSync(path, next);
}
writeFileSync('/etc/apt/apt.conf.d/80-vkify-ci-network', 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n');
