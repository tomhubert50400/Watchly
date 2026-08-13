import type { Metadata } from 'next';
import { LegalArticle } from '../../../components/LegalArticle';
import { legalDocuments } from '../../../content/legal';

export const metadata: Metadata = {
  description: legalDocuments.community.description,
  title: legalDocuments.community.title,
};

export default function CommunityGuidelinesPage() {
  return <LegalArticle document={legalDocuments.community} />;
}
