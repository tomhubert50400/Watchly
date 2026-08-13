import type { Metadata } from 'next';
import { AdminConsole } from '../../admin/AdminConsole';

export const metadata: Metadata = {
  description: 'Private Watchly moderation console.',
  robots: { follow: false, index: false },
  title: 'Moderation console',
};

export default function AdminPage() {
  return <AdminConsole />;
}
