#!/usr/bin/env node
// Exercise the actual level 2 checks in Bash and the generated browser data.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(new URL('../bashquest.sh', import.meta.url), 'utf8');
const helper = source.match(/^chk\(\) \{.*\}$/m)?.[0];
const level = source.match(/^run_level_2\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(helper && level, 'Could not locate the Bash validator and level 2');

// Load only the helper and level definition. Stubs avoid starting the game,
// creating a sandbox, or touching the player's account and progress files.
const bashCheck = `${helper}\n${level}
level_intro() { :; }
setup_game_env() { :; }
cleanup_game_env() { :; }
level_complete() { :; }
run_challenge() {
    if [ "$1" = "$title" ]; then check="$4"; fi
}
title=$1
run_level_2
[ -n "$check" ] || exit 2
user_input=$2
eval "$check"
`;

execFileSync(process.execPath, ['scripts/extract-levels.mjs'], { cwd: root });
const levels = JSON.parse(readFileSync(new URL('../src/game/data/levels.json', import.meta.url), 'utf8'));
const challenges = levels.find(level => level.num === 2).challenges;

const cases = [
    ['Create a tar Archive', true, [
        'tar -czf home.tar.gz home/',
        'tar czf home.tar.gz home/',
        'tar zcf home.tar.gz home/',
        'tar czvf home.tar.gz home/',
        'tar -czvf home.tar.gz home/',
        'tar -c -z -f home.tar.gz home/',
    ]],
    ['Create a tar Archive', false, [
        'tar xzf home.tar.gz home/',
        'tar tzf home.tar.gz',
        'tar czf home.tar.gz',
        'echo tar czf home.tar.gz home/',
    ]],
    ['Extract to a Specific Directory', true, [
        'tar -xzf home.tar.gz -C tmp/',
        'tar -xf home.tar.gz -C tmp',
        'tar -xf home.tar.gz --directory tmp',
        'tar -xzf home.tar.gz --directory tmp/',
        'tar -xf home.tar.gz --directory=tmp',
        'tar -xzf home.tar.gz --directory=tmp/',
        'tar xf home.tar.gz --directory tmp',
        'tar -C tmp/ -xzf home.tar.gz',
        'tar --directory tmp -xf home.tar.gz',
        'tar --directory=tmp/ -xzf home.tar.gz',
    ]],
    ['Extract to a Specific Directory', false, [
        'tar -tzf home.tar.gz --directory tmp',
        'tar -czf home.tar.gz --directory tmp',
        'tar -xf home.tar.gz',
        'tar -xf home.tar.gz --directory',
        'tar -xf home.tar.gz --directory=',
        'tar -xf home.tar.gz --directoryfoo tmp',
        'tar -xf home.tar.gz -C',
        'echo tar -xf home.tar.gz --directory tmp',
    ]],
];

let count = 0;
for (const [title, expected, inputs] of cases) {
    const challenge = challenges.find(challenge => challenge.title === title);
    assert.equal(challenge?.checkType, 'regex');
    for (const input of inputs) {
        const result = spawnSync('bash', ['-c', bashCheck, '--', title, input], { encoding: 'utf8' });
        assert.ifError(result.error);
        assert.ok(result.status === 0 || result.status === 1, result.stderr || `Unexpected Bash status: ${result.status}`);
        assert.equal(result.status === 0, expected, `Bash: ${input}`);
        assert.equal(new RegExp(challenge.checkValue).test(input), expected, `Browser: ${input}`);
        count++;
    }
}
console.log(`Passed ${count} tar cases in both Bash and the browser validator.`);
