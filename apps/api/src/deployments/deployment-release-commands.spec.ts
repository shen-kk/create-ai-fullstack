import { describe, expect, it } from 'vitest';
import {
  atomicReleaseSwitchCommand,
  deploymentHealthCheckCommand,
  deploymentReleaseCommand,
  shellQuote,
} from './deployment-release-commands.js';

describe('deployment release commands', () => {
  it('quotes paths and switches through a temporary symlink', () => {
    const command = atomicReleaseSwitchCommand('/srv/my app', "/srv/my app/releases/release'1");

    expect(command).toContain("ln -sfn '/srv/my app/releases/release'\\''1'");
    expect(command).toContain("'/srv/my app/.current-next'");
    expect(command).toContain("mv -Tf '/srv/my app/.current-next' '/srv/my app/current'");
  });

  it('quotes health URLs before adding retry behavior', () => {
    expect(deploymentHealthCheckCommand("https://example.com/ready?value='ok'")).toContain(
      shellQuote("https://example.com/ready?value='ok'"),
    );
  });

  it('loads the release environment before running a command', () => {
    expect(deploymentReleaseCommand('/srv/my app', 'pnpm build')).toBe(
      "cd '/srv/my app' && set -a && . ./.env && set +a && pnpm build",
    );
  });
});
