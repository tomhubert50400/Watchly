export type LegalSection = {
  body: string[];
  title: string;
};

export type LegalDocument = {
  description: string;
  eyebrow: string;
  sections: LegalSection[];
  title: string;
  updatedAt: string;
};

export const legalDocuments = {
  accountDeletion: {
    description: 'How to permanently delete a Watchly account and what happens to its data.',
    eyebrow: 'Account controls',
    sections: [
      {
        body: [
          'Open Watchly, go to Profile, open Settings, then choose Delete account. Review the consequences and confirm the deletion while signed in to the account you want to remove.',
          'If you cannot access the app, contact support from the email address connected to your sign-in provider. Include your Watchly display name or handle, but never send a password, verification code, or authentication token.',
        ],
        title: 'Request deletion',
      },
      {
        body: [
          'Deletion removes the Watchly account and associated profile, privacy settings, viewing activity, ratings, reviews, follows, blocks, watchlists, votes, alerts, and in-app notifications. It does not delete the separate Google, Apple, or Microsoft account used to sign in.',
          'Deleting an account is permanent. Export any information you want to keep before confirming the request.',
        ],
        title: 'What is deleted',
      },
      {
        body: [
          'The active account data is removed when the deletion succeeds. Limited records may be retained when required for security, fraud prevention, dispute handling, or a legal obligation. Temporary encrypted backups expire through their normal rotation.',
        ],
        title: 'Retention after deletion',
      },
    ],
    title: 'Delete your Watchly account',
    updatedAt: 'August 13, 2026',
  },
  community: {
    description: 'The rules that keep Watchly reviews, profiles, and shared spaces useful and safe.',
    eyebrow: 'Community standards',
    sections: [
      {
        body: [
          'Discuss films and series without attacking the people behind another opinion. Harassment, threats, stalking, targeted humiliation, and encouragement of abuse are not allowed.',
        ],
        title: 'Respect other members',
      },
      {
        body: [
          'Do not promote hatred, dehumanization, or exclusion based on protected characteristics. Graphic sexual content, credible threats, and content that facilitates real-world violence are prohibited.',
        ],
        title: 'No hate or dangerous content',
      },
      {
        body: [
          'Use an identity you are entitled to represent. Do not impersonate another person or organization, manipulate engagement, send repeated unsolicited messages, or automate spam.',
        ],
        title: 'Be authentic',
      },
      {
        body: [
          'Post only material you have the right to share. Do not expose private personal information, credentials, private messages, or another person’s sensitive data without permission.',
        ],
        title: 'Protect rights and privacy',
      },
      {
        body: [
          'Use the report action on a profile or review when these rules may have been broken. Reports are reviewed in context. Watchly may reject a report, limit content, restrict an account, or take another proportionate action. Repeated misuse of reporting tools may also be restricted.',
        ],
        title: 'Reporting and enforcement',
      },
    ],
    title: 'Community guidelines',
    updatedAt: 'August 13, 2026',
  },
  privacy: {
    description: 'What Watchly stores, why it is used, and the controls available to every member.',
    eyebrow: 'Legal',
    sections: [
      {
        body: [
          'Watchly is the data controller for information created inside the service. The verified publisher legal name, postal address, and current contact details are provided in the store listing for the version of Watchly you installed.',
        ],
        title: 'Who is responsible',
      },
      {
        body: [
          'Watchly stores your authentication identifier and provider, display name, handle, privacy choices, viewing status, episode progress, ratings, reviews, likes, follows, blocks, watchlists, votes, release alerts, and in-app notifications.',
          'The service also records security, moderation, audit, and technical events needed to protect accounts, investigate abuse, and keep the service reliable.',
        ],
        title: 'Data we process',
      },
      {
        body: [
          'If you join the Watchly waitlist, we store your email address and signup date so we can contact you about availability and launch updates.',
          'You can ask us to remove your waitlist email at any time through the Support page. Waitlist data is separate from any Watchly account you may create later.',
        ],
        title: 'Waitlist',
      },
      {
        body: [
          'We use this information to create and secure your account, synchronize your library, show activity according to your privacy choices, operate shared lists and votes, deliver requested alerts, respond to support requests, and enforce the community rules.',
          'Private viewing activity is not published unless you change the matching privacy setting.',
        ],
        title: 'How we use it',
      },
      {
        body: [
          'Authentication is provided through Firebase. Film, series, artwork, and streaming availability come from TMDB. Streaming availability data is supplied to TMDB by JustWatch. Watchly sends catalogue identifiers when requesting this information, not your private journal or review text.',
        ],
        title: 'Service providers and catalogue data',
      },
      {
        body: [
          'A public profile can expose your display name, handle, follows, ratings, and written reviews according to your settings. Shared list members can see the list content and votes available to that group. Your Journal and private choices are not public profile content.',
        ],
        title: 'What other people can see',
      },
      {
        body: [
          'Account data is kept while your account is active. When you delete your account, Watchly removes the account and associated app data unless a limited record must be retained for security or a legal obligation. Temporary backups may remain until their normal rotation completes.',
        ],
        title: 'Retention and deletion',
      },
      {
        body: [
          'You can correct your profile and privacy choices in Settings, export a copy of your account data, or delete your account. Depending on where you live, you may also have rights to access, correct, restrict, object, or complain to a data protection authority.',
        ],
        title: 'Your choices and rights',
      },
    ],
    title: 'Privacy policy',
    updatedAt: 'September 3, 2026',
  },
  terms: {
    description: 'The agreement that governs access to Watchly and its social features.',
    eyebrow: 'Legal',
    sections: [
      {
        body: [
          'Watchly helps you discover films and series, track viewing activity, keep ratings and reviews, and collaborate through shared watchlists. Catalogue and streaming information can change and may not be complete in every country.',
        ],
        title: 'The service',
      },
      {
        body: [
          'You are responsible for activity performed through your sign-in provider and for keeping access to that provider secure. Do not impersonate another person, automate abusive traffic, bypass access controls, or use Watchly to break the law or harm others.',
        ],
        title: 'Your account',
      },
      {
        body: [
          'You keep ownership of reviews and other text you create. You allow Watchly to store, process, moderate, and display that content only as needed to operate the service and according to your privacy choices. Do not post unlawful, infringing, threatening, deceptive, or abusive content.',
        ],
        title: 'Your content',
      },
      {
        body: [
          'Film, series, artwork, trademarks, and provider information belong to their respective owners. Watchly does not grant rights to third-party catalogue content. Availability information is informational and should be confirmed with the relevant streaming provider.',
        ],
        title: 'Third-party content',
      },
      {
        body: [
          'You may stop using Watchly at any time and can delete your account from Settings. Watchly may limit content or restrict access when reasonably necessary to protect members, enforce these terms and the community rules, or meet a legal requirement.',
        ],
        title: 'Moderation and ending use',
      },
      {
        body: [
          'Mandatory consumer protections in your country continue to apply. To the extent permitted by law, Watchly is provided without a promise that catalogue data, availability, or uninterrupted access will always be accurate or available.',
        ],
        title: 'Consumer rights and availability',
      },
    ],
    title: 'Terms of use',
    updatedAt: 'August 13, 2026',
  },
} satisfies Record<string, LegalDocument>;

export const publicLegalRoutes = [
  '/privacy',
  '/terms',
  '/community-guidelines',
  '/support',
  '/account-deletion',
] as const;
