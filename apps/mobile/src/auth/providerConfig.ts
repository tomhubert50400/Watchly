export type AuthProviderConfig = {
  id: 'apple' | 'discord' | 'facebook' | 'google' | 'microsoft';
  isWired: boolean;
  name: 'Apple' | 'Discord' | 'Facebook' | 'Google' | 'Microsoft';
  presentation: 'primary' | 'secondary';
};

export const authProviders: readonly AuthProviderConfig[] = [
  { id: 'google', isWired: true, name: 'Google', presentation: 'primary' },
  { id: 'apple', isWired: true, name: 'Apple', presentation: 'primary' },
  { id: 'microsoft', isWired: true, name: 'Microsoft', presentation: 'secondary' },
  { id: 'discord', isWired: false, name: 'Discord', presentation: 'secondary' },
  { id: 'facebook', isWired: false, name: 'Facebook', presentation: 'secondary' },
] as const;
