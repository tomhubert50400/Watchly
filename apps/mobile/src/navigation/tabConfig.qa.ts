import { mainTabs } from './tabConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const routeNames: string[] = mainTabs.map((tab) => tab.name);
const labels: string[] = mainTabs.map((tab) => tab.label);

assert(
  JSON.stringify(routeNames) === JSON.stringify(['Home', 'Explore', 'Library', 'Profile']),
  'Main tabs must remain Home, Explore, Library, Profile in that order.',
);
assert(
  JSON.stringify(labels) === JSON.stringify(['Home', 'Explore', 'Library', 'Profile']),
  'Main tab labels must match the approved architecture.',
);
assert(!routeNames.includes('Feed'), 'Feed must not remain a primary tab route.');
assert(!routeNames.includes('MyTV'), 'MyTV must be replaced by Library.');

console.log('Tab config QA passed.');
