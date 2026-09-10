import { TrackedContentType } from '../generated/prisma/enums';

type CharacterDefinition = {
  key: string;
  name: string;
  continuity: string;
  appearances: Array<{ contentType: TrackedContentType; tmdbId: number }>;
};

const movies = (...ids: number[]) => ids.map((tmdbId) => ({ contentType: TrackedContentType.MOVIE, tmdbId }));

// Verified against TMDB movie credits on 2026-09-10. See docs/character-alerts.md.
// Identity belongs to a continuity, never to an actor or a role-name match.
export const CHARACTER_CATALOGUE: CharacterDefinition[] = [
  {
    key: 'iron-man-mcu', name: 'Iron Man', continuity: 'Marvel Cinematic Universe',
    appearances: movies(1726, 1724, 10138, 24428, 68721, 99861, 271110, 315635, 299536, 299534),
  },
  {
    key: 'jack-sparrow-pirates', name: 'Jack Sparrow', continuity: 'Pirates of the Caribbean',
    appearances: movies(22, 58, 285, 1865, 166426),
  },
  {
    key: 'james-bond-craig', name: 'James Bond', continuity: 'Casino Royale continuity',
    appearances: movies(36557, 10764, 37724, 206647, 370172),
  },
  {
    key: 'batman-dark-knight', name: 'Batman', continuity: 'The Dark Knight trilogy',
    appearances: movies(272, 155, 49026),
  },
  {
    key: 'albus-dumbledore-wizarding-world', name: 'Albus Dumbledore', continuity: 'Wizarding World films',
    appearances: movies(671, 672, 673, 674, 675, 767, 12444, 12445, 338952, 338953),
  },
  {
    key: 'harry-potter-original-films', name: 'Harry Potter', continuity: 'Original Harry Potter films',
    appearances: movies(671, 672, 673, 674, 675, 767, 12444, 12445),
  },
];

export function characterReleaseTitles<T extends { characterKey: string; userId: string }>(subscriptions: T[]) {
  return subscriptions.flatMap((subscription) =>
    (CHARACTER_CATALOGUE.find((item) => item.key === subscription.characterKey)?.appearances ?? [])
      .map((appearance) => ({ ...appearance, userId: subscription.userId })),
  );
}
