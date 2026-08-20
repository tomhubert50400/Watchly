export type AuthProviderConfig = {
  id: 'apple' | 'discord' | 'google' | 'microsoft';
  isWired: boolean;
  name: 'Apple' | 'Discord' | 'Google' | 'Microsoft';
  presentation: 'primary' | 'secondary';
};

export const authProviders: readonly AuthProviderConfig[] = [
  { id: 'google', isWired: true, name: 'Google', presentation: 'primary' },
  { id: 'apple', isWired: true, name: 'Apple', presentation: 'primary' },
  { id: 'microsoft', isWired: true, name: 'Microsoft', presentation: 'secondary' },
  { id: 'discord', isWired: true, name: 'Discord', presentation: 'secondary' },
] as const;
