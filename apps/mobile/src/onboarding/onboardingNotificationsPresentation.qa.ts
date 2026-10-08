import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./OnboardingScreen.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const footerSource = source.slice(source.indexOf('function OnboardingFooter'), source.indexOf('function ProfileStep'));
const requestSource = source.slice(source.indexOf('  async function allowNotifications()'), source.indexOf('  async function finishOnboarding()'));
const requestEffect = source.match(/useEffect\((\(\) => \{\s*if \(!draftReady[\s\S]*?\n  \}), \[allowNotifications,/);
assert.ok(requestEffect, 'entering the notification step must automatically request system permission');

assert.doesNotMatch(source, /notificationSkipConfirmation|requestNotificationSkip|onEnableNotifications|notificationEnableAction|Are you sure\?/, 'onboarding must not ask before or reconfirm the system permission choice');
assert.match(source, /!notificationOutcome \|\| notificationStatus === 'requesting' \|\| isFinishing[\s\S]*<LoadingState[\s\S]*notificationOutcome.status === 'enabled'[\s\S]*: <NotificationsStep outcome=\{notificationOutcome\}/, 'the explanation must appear only after a non-enabled result');
assert.match(footerSource, /disabled=\{!notificationOutcome \|\| notificationStatus === 'requesting' \|\| isFinishing\}/, 'completion must wait for the system permission result');
assert.match(footerSource, /label=\{error \? 'Try again' : 'Continue to Watchly'\}[\s\S]*onPress=\{onFinish\}/, 'refusal and completion failures must both leave a way to finish onboarding');
assert.match(source, /onFinish=\{\(\) => void finishOnboarding\(\)\}/);
assert.match(source, /Notifications let you know when movies and TV shows you follow are released/);
assert.match(source, /You can keep using Watchly without notifications and turn them on later in your device settings\./);
assert.match(source, /iPhone Settings > Notifications > Watchly[\s\S]*device settings > Apps > Watchly > Notifications[\s\S]*label="Open Settings"[\s\S]*Linking\.openSettings\(\)/, 'the explanation must offer platform-specific settings recovery');
assert.match(source, /notificationsHeading: \{\s*\.\.\.typography\.title,\s*color: colors\.accentText,\s*\}/);
assert.match(source, /getOnboardingTasteOptions\(\)[\s\S]*response\.movies[\s\S]*setCataloguePosterItems[\s\S]*notificationPreviews\.map/, 'notification examples retain selected or catalogue artwork');
assert.match(source, /item\?\.posterUrl[\s\S]*<MediaPoster[\s\S]*styles\.notificationPosterSkeleton/);

type Outcome = { status: 'enabled' | 'denied' | 'disabled' | 'unavailable'; message?: string };
function createFlow(enable: () => Promise<Outcome>) {
  let completions = 0;
  let requests = 0;
  const context = {
    draftReady: true,
    currentUser: { id: 'viewer' },
    firebaseIdToken: 'token',
    step: 'notifications',
    stepTransition: null as object | null,
    notificationRequestStarted: { current: false },
    notificationStatus: 'idle',
    notificationOutcome: null as Outcome | null,
    isFinishing: false,
    error: null as unknown,
    setNotificationStatus: (value: string) => { context.notificationStatus = value; },
    setNotificationOutcome: (value: Outcome | null) => { context.notificationOutcome = value; },
    setError: (value: unknown) => { context.error = value; },
    hapticError: () => {},
    enableAllPushFromOnboarding: async (token: string, userId: string) => {
      assert.equal(token, 'token');
      assert.equal(userId, 'viewer');
      requests += 1;
      return enable();
    },
    finishOnboarding: async () => { completions += 1; },
  };
  const request = runInNewContext(`${requestSource}\n(${requestEffect![1]})`, context) as () => void;
  return { context, request, completions: () => completions, requests: () => requests };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
async function run() {
  let resolvePermission!: (value: Outcome) => void;
  const flow = createFlow(() => new Promise((resolve) => { resolvePermission = resolve; }));
  flow.context.step = 'taste';
  flow.request();
  assert.equal(flow.requests(), 0, 'earlier steps must never request permission');
  flow.context.step = 'notifications';
  flow.context.draftReady = false;
  flow.request();
  assert.equal(flow.requests(), 0, 'draft restoration must finish first');
  flow.context.draftReady = true;
  flow.context.stepTransition = {};
  flow.request();
  assert.equal(flow.requests(), 0, 'the system alert must wait for the page transition');
  flow.context.stepTransition = null;
  flow.request();
  flow.request();
  assert.equal(flow.requests(), 1, 'rerenders must not duplicate an in-flight permission request');
  assert.equal(flow.completions(), 0, 'onboarding must wait for the user response');
  resolvePermission({ status: 'enabled' });
  await settle();
  assert.equal(flow.completions(), 1, 'acceptance must finish onboarding automatically');
  flow.request();
  assert.equal(flow.requests(), 1, 'rerenders after acceptance must not request again');

  for (const status of ['denied', 'disabled', 'unavailable'] as const) {
    const declined = createFlow(async () => ({ status }));
    declined.request();
    await settle();
    assert.equal(declined.context.notificationOutcome?.status, status);
    assert.equal(declined.completions(), 0, 'a refusal must leave the explanation visible');
    assert.equal(declined.context.notificationStatus, 'idle', 'the continue button must be usable after refusal');
    declined.request();
    assert.equal(declined.requests(), 1, 'a refusal must not trigger another system request');
  }

  const failed = createFlow(async () => { throw new Error('Registration unavailable'); });
  failed.request();
  await settle();
  assert.equal(failed.context.notificationOutcome?.status, 'unavailable');
  assert.equal(failed.context.notificationStatus, 'idle', 'setup failures must not leave onboarding blocked');
  assert.equal(failed.completions(), 0);
  console.log('Onboarding notifications QA passed: automatic permission, acceptance, refusal, and recovery.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
