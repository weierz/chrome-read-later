import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dir, '..')
describe('release package', () => {
    test('places the manifest and all entry points at the zip root', () => {
        const output = mkdtempSync(join(tmpdir(), 'read-later-package-test-'))
        try {
            const run = spawnSync('sh', [join(root, 'release.sh')], {
                cwd: output,
                env: { ...process.env, HOME: output, CHROME_READ_LATER_RELEASE_DIR: output },
                encoding: 'utf8',
            })
            expect(run.status).toBe(0)
            const zip = join(output, 'chrome-read-later.zip')
            const manifestResult = spawnSync('unzip', ['-p', zip, 'manifest.json'], {
                encoding: 'utf8',
            })
            expect(manifestResult.status).toBe(0)
            const manifest = JSON.parse(manifestResult.stdout)
            const entries = spawnSync('unzip', ['-Z1', zip], {
                encoding: 'utf8',
            }).stdout.split('\n')
            const required = [
                manifest.background.service_worker,
                manifest.action.default_popup,
                manifest.options_page,
                manifest.options_ui?.page,
                manifest.side_panel?.default_path,
                ...Object.values(manifest.icons || {}),
                ...manifest.content_scripts.flatMap(item => item.js || []),
            ].filter(Boolean)
            for (const path of required) expect(entries).toContain(path)
            expect(entries.some(path => path.endsWith('.test.mjs'))).toBe(false)
            expect(entries.some(path => path.includes('.DS_Store'))).toBe(false)
        } finally {
            rmSync(output, { recursive: true, force: true })
        }
    })
})
