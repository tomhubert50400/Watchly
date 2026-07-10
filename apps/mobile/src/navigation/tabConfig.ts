export type MainTabName = 'Explore' | 'Home' | 'Library' | 'Profile';

export type MainTabConfig = {
  icon: 'compass' | 'home' | 'library' | 'profile';
  label: string;
  name: MainTabName;
};

export const mainTabs: readonly MainTabConfig[] = [
  { icon: 'home', label: 'Home', name: 'Home' },
  { icon: 'compass', label: 'Explore', name: 'Explore' },
  { icon: 'library', label: 'Library', name: 'Library' },
  { icon: 'profile', label: 'Profile', name: 'Profile' },
] as const;
