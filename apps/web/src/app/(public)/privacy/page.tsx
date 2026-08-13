import type { Metadata } from 'next';
import { LegalArticle } from '../../../components/LegalArticle';
import { legalDocuments } from '../../../content/legal';

export const metadata: Metadata = {
  description: legalDocuments.privacy.description,
  title: legalDocuments.privacy.title,
};

export default function PrivacyPage() {
  return <LegalArticle document={legalDocuments.privacy} />;
}
