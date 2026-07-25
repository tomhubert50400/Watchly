// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { legalDocumentIds, legalDocuments } from './legalDocuments';

assert.deepEqual(legalDocumentIds, ['privacy', 'terms', 'legalNotice', 'licenses']);

for (const id of legalDocumentIds) {
  const document = legalDocuments[id];

  assert(document.title.length > 0, `${id} must have a title`);
  assert(document.intro.length > 0, `${id} must have an introduction`);
  assert(document.sections.length > 0, `${id} must contain at least one section`);
  assert(
    document.sections.every((section) => section.title.length > 0 && section.body.length > 0),
    `${id} sections must include plain-language content`,
  );
}

const privacyText = legalDocuments.privacy.sections.map((section) => section.body).join(' ');
assert.match(privacyText, /export a copy/i, 'privacy policy must explain data portability');
assert.match(privacyText, /delete your account/i, 'privacy policy must explain account deletion');

const creditText = legalDocuments.licenses.sections.map((section) => section.body).join(' ');
assert.match(
  creditText,
  /This product uses the TMDB API but is not endorsed or certified by TMDB\./,
  'TMDB attribution must use the required notice',
);
assert.match(creditText, /JustWatch/, 'streaming availability must credit JustWatch');

console.log('Legal documents QA passed.');
