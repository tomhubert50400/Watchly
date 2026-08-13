import assert from 'node:assert/strict';
import { legalDocuments, publicLegalRoutes } from './legal';

assert.deepEqual(publicLegalRoutes, [
  '/privacy',
  '/terms',
  '/community-guidelines',
  '/support',
  '/account-deletion',
]);

for (const [id, document] of Object.entries(legalDocuments)) {
  assert(document.title.length > 0, `${id} must have a title.`);
  assert(document.description.length > 0, `${id} must have a description.`);
  assert(document.sections.length > 0, `${id} must contain sections.`);
  assert(
    document.sections.every((section) => section.title && section.body.every(Boolean)),
    `${id} sections must contain complete plain-language copy.`,
  );
}

const privacyText = legalDocuments.privacy.sections.flatMap((section) => section.body).join(' ');
assert.match(privacyText, /export a copy/i);
assert.match(privacyText, /delete your account/i);

const deletionText = legalDocuments.accountDeletion.sections
  .flatMap((section) => section.body)
  .join(' ');
assert.match(deletionText, /Profile/);
assert.match(deletionText, /Settings/);
assert.match(deletionText, /permanent/i);

console.log('Web legal content QA passed.');
