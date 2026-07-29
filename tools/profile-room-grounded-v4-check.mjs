#!/usr/bin/env node
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });

const report = await page.evaluate(() => {
  const debug = window.__profileAdventureDebug;
  debug.setTime(0);
  const actorIds = ["nobita", "doraemon", "shizuka", "gian", "suneo"];
  const maximumBlocked = Object.fromEntries(actorIds.map((id) => [id, 0]));
  const minimumDistance = { value: Infinity, at: 0, actors: [] };
  const obstacleViolations = [];
  const threeActorClusters = [];
  const durationSamples = {};
  const snapshots = {};
  const previousActivity = {};
  for (let second = 0; second <= 900; second += 1) {
    const state = debug.getState();
    if ([0, 30, 60, 120, 180, 300, 600, 900].includes(second)) {
      snapshots[second] = Object.fromEntries(actorIds.map((id) => [id, {
        state: state.actors[id].state,
        position: state.actors[id].position,
        station: state.actors[id].station,
        blocked: state.actors[id].blockedElapsed,
        replans: state.actors[id].replanCount
      }]));
    }
    for (const id of actorIds) {
      const actor = state.actors[id];
      maximumBlocked[id] = Math.max(maximumBlocked[id], actor.blockedElapsed);
      const activityKey = `${actor.state}:${actor.station}`;
      if (previousActivity[id] !== activityKey && !["walking", "choosing", "waiting", "portal-away", "portal-returning", "manual-action"].includes(actor.state)) {
        (durationSamples[actor.station] ||= []).push(actor.activityDuration);
      }
      previousActivity[id] = activityKey;
      for (const prop of Object.values(state.layout.props)) {
        const bounds = prop.collisionBounds;
        if (!bounds || actor.state === "portal-away" || !actor.visible) continue;
        const [x, y] = actor.position;
        if (x > bounds[0] && x < bounds[2] && y > bounds[1] && y < bounds[3]) {
          obstacleViolations.push({ second, actor: id, prop: prop.id, position: actor.position });
        }
      }
    }
    const visible = actorIds.filter((id) => state.actors[id].visible);
    const closePairs = [];
    for (let first = 0; first < visible.length; first += 1) {
      for (let secondIndex = first + 1; secondIndex < visible.length; secondIndex += 1) {
        const a = state.actors[visible[first]].position;
        const b = state.actors[visible[secondIndex]].position;
        const value = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (value < minimumDistance.value) Object.assign(minimumDistance, { value, at: second, actors: [visible[first], visible[secondIndex]] });
        if (value < 0.065) closePairs.push([visible[first], visible[secondIndex]]);
      }
    }
    const closeActors = new Set(closePairs.flat());
    if (closeActors.size >= 3) threeActorClusters.push({ second, actors: [...closeActors], closePairs });
    if (second < 900) debug.advanceTime(1);
  }
  const final = debug.getState();
  return {
    layoutVersion: final.layoutVersion,
    maximumBlocked,
    minimumDistance,
    obstacleViolations: obstacleViolations.slice(0, 12),
    obstacleViolationCount: obstacleViolations.length,
    threeActorClusters: threeActorClusters.slice(0, 12),
    threeActorClusterCount: threeActorClusters.length,
    durationSamples,
    visited: Object.fromEntries(actorIds.map((id) => [id, final.actors[id].visitedStations])),
    deadlockRecoveries: final.navigation.deadlockRecoveries,
    snapshots
  };
});

console.log(JSON.stringify({ errors, report }, null, 2));
await browser.close();
