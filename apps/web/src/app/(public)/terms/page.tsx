import type { Metadata } from 'next';
import { LegalArticle } from '../../../components/LegalArticle';
import { legalDocuments } from '../../../content/legal';

export const metadata: Metadata = {
  description: legalDocuments.terms.description,
  title: legalDocuments.terms.title,
};

export default function TermsPage() {
  return <LegalArticle document={legalDocuments.terms} />;
}
