export const legalDocumentIds = [
  'privacy',
  'terms',
  'legalNotice',
  'licenses',
] as const;

export type LegalDocumentId = (typeof legalDocumentIds)[number];

type LegalLink = {
  label: string;
  url: string;
};

type LegalSection = {
  body: string;
  links?: LegalLink[];
  title: string;
};

export type LegalDocument = {
  intro: string;
  sections: LegalSection[];
  title: string;
  updatedAt: string;
};

export const legalDocuments: Record<LegalDocumentId, LegalDocument> = {
  privacy: {
    intro: 'This policy explains what Watchly stores, why it is used, and the choices available to you.',
    sections: [
      {
        body: 'Watchly is the data controller for information created inside the service. The publisher legal name, postal address, and current contact details are provided in the store listing for the version of Watchly you installed.',
        title: 'Who is responsible',
      },
      {
        body: 'Watchly stores your authentication identifier and provider, display name, privacy choices, viewing status, episode progress, ratings, reviews, likes, follows, blocks, watchlists, votes, release alerts, and in-app notifications. The service also records technical security events needed to protect accounts and investigate abuse.',
        title: 'Data we process',
      },
      {
        body: 'We use this information to create and secure your account, synchronize your library, show your chosen public activity, operate shared lists and votes, send requested release alerts, and maintain the service. Private viewing activity is not published unless you change the matching privacy setting.',
        title: 'How we use it',
      },
      {
        body: 'Authentication is provided through Firebase. Film, series, artwork, and streaming availability come from TMDB. Streaming availability data is supplied to TMDB by JustWatch. Watchly sends catalogue identifiers when requesting this information, not your private journal or review text.',
        title: 'Service providers and catalogue data',
      },
      {
        body: 'A public profile can expose your display name, follows, ratings, and written reviews according to your settings. Shared list members can see the list content and votes available to that group. Your Journal and private choices are not public profile content.',
        title: 'What other people can see',
      },
      {
        body: 'Account data is kept while your account is active. When you delete your account, Watchly removes the account and associated app data unless a limited record must be retained for security or a legal obligation. Temporary backups may remain until their normal rotation completes.',
        title: 'Retention and deletion',
      },
      {
        body: 'You can correct your display name and privacy choices in Settings, export a copy of your account data, or delete your account. Depending on where you live, you may also have rights to access, correct, restrict, object, or complain to a data protection authority. Use the publisher contact in the store listing for requests that cannot be completed in the app.',
        title: 'Your choices and rights',
      },
    ],
    title: 'Privacy policy',
    updatedAt: 'July 22, 2026',
  },
  terms: {
    intro: 'These terms describe the basic rules for using Watchly and its social features.',
    sections: [
      {
        body: 'Watchly helps you discover films and series, track viewing activity, keep ratings and reviews, and collaborate through shared watchlists. Catalogue and streaming information can change and may not be complete in every country.',
        title: 'The service',
      },
      {
        body: 'You are responsible for activity performed through your sign-in provider and for keeping access to that provider secure. Do not impersonate another person, automate abusive traffic, bypass access controls, or use Watchly to break the law or harm others.',
        title: 'Your account',
      },
      {
        body: 'You keep ownership of reviews and other text you create. You allow Watchly to store, process, and display that content only as needed to operate the service and according to your privacy choices. Do not post unlawful, infringing, threatening, or abusive content.',
        title: 'Your content',
      },
      {
        body: 'Film, series, artwork, trademarks, and provider information belong to their respective owners. Watchly does not grant rights to third-party catalogue content. Availability information is informational and should be confirmed with the relevant streaming provider.',
        title: 'Third-party content',
      },
      {
        body: 'You may stop using Watchly at any time and can delete your account from Settings. Watchly may restrict access when necessary to protect users, enforce these terms, or meet a legal requirement. Material changes to these terms should be communicated before they take effect.',
        title: 'Ending use and changes',
      },
      {
        body: 'Mandatory consumer protections in your country continue to apply. To the extent permitted by law, Watchly is provided without a promise that catalogue data, availability, or uninterrupted access will always be accurate or available.',
        title: 'Consumer rights and availability',
      },
    ],
    title: 'Terms of use',
    updatedAt: 'July 22, 2026',
  },
  legalNotice: {
    intro: 'Publisher and service information for Watchly.',
    sections: [
      {
        body: 'Service name: Watchly. The verified publisher legal name, business or residential address as applicable, email address, and phone number are provided in the Apple App Store or Google Play listing from which the app was obtained.',
        title: 'Publisher',
      },
      {
        body: 'The publisher is responsible for Watchly product content. Film and series metadata, artwork, and related third-party marks remain the property of their respective owners.',
        title: 'Editorial responsibility',
      },
      {
        body: 'Questions about the service, privacy requests, and reports of unlawful content should be sent to the current publisher contact shown in the store listing. Include enough detail to identify the request without sending a password or authentication token.',
        title: 'Contact and reports',
      },
    ],
    title: 'Legal notice',
    updatedAt: 'July 22, 2026',
  },
  licenses: {
    intro: 'Watchly is built with open-source software and third-party catalogue services.',
    sections: [
      {
        body: 'The mobile app uses Expo, React, React Native, React Navigation, Lucide, Firebase client libraries, and their dependencies. Each component remains subject to its own copyright notice and license. The source distribution and installed package metadata contain the applicable license texts.',
        title: 'Open-source software',
      },
      {
        body: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
        links: [{ label: 'Visit The Movie Database', url: 'https://www.themoviedb.org' }],
        title: 'TMDB attribution',
      },
      {
        body: 'Streaming availability information is provided by JustWatch through TMDB. Availability can vary by country and change after it is displayed in Watchly.',
        links: [{ label: 'Visit JustWatch', url: 'https://www.justwatch.com' }],
        title: 'JustWatch attribution',
      },
    ],
    title: 'Licenses and credits',
    updatedAt: 'July 22, 2026',
  },
};

export function isLegalDocumentId(value: string): value is LegalDocumentId {
  return legalDocumentIds.includes(value as LegalDocumentId);
}
