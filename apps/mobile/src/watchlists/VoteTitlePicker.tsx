import type { ComponentProps } from 'react';
import { CatalogueTitlePicker } from '../catalogue/CatalogueTitlePicker';

export { catalogueTitleKey as voteMediaKey } from '../catalogue/CatalogueTitlePicker';

export function VoteTitlePicker(props: Omit<ComponentProps<typeof CatalogueTitlePicker>, 'label' | 'selectionHint'>) {
  return <CatalogueTitlePicker {...props} label="Search vote titles" selectionHint="New titles also join this watchlist" />;
}
