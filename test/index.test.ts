// TODO: Implement all the tests for the index.ts file
// TODO: Implement all test for the handlePullRequest.ts file
// This is just a sample rudiementary test to get started

import nock from 'nock';
import { Probot, ProbotOctokit } from 'probot';
import myProbotApp from '../src/index';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe('My Probot app', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      appId: 123,
      privateKey: 'test',
      // Disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });

    probot.load(myProbotApp);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // setup the config for required actions and break ceiling label
  const config = {
    required_actions: ['actions/checkout@v2', 'actions/setup-node@v2'],
    break_ceiling: {
      label: 'allow-bypass',
    },
  };

  const loadFixture = (filename: string): string => {
    return fs.readFileSync(path.join(__dirname, 'fixtures', filename), 'utf8');
  };

  const loadJsonFixture = (filename: string): any => {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', filename), 'utf8'));
  };

  test('skips checks if the break ceiling label is present', async () => {
    const payload = loadJsonFixture('payload.json');
    payload.pull_request.labels.push({ name: config.break_ceiling.label });

    await probot.receive({
      name: 'pull_request', 
      id: '1',
      payload,
    });

    expect(nock.isDone()).toBe(true);
  });
});