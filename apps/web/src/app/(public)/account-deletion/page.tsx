import type { Metadata } from 'next';
import { LegalArticle } from '../../../components/LegalArticle';
import { legalDocuments } from '../../../content/legal';

export const metadata: Metadata = {
  description: legalDocuments.accountDeletion.description,
  title: legalDocuments.accountDeletion.title,
};

export default function AccountDeletionPage() {
  return <LegalArticle document={legalDocuments.accountDeletion} />;
}
