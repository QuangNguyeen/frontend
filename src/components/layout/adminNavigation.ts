import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  LineChart,
  MessageSquareWarning,
  SendToBack,
  Tags,
  Users,
  Video,
} from 'lucide-react';

export interface AdminNavigationItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  end?: boolean;
}

export const adminNavigation: AdminNavigationItem[] = [
  {
    to: '/admin',
    label: 'Overview',
    description: 'System health and attention items',
    icon: BarChart3,
    end: true,
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    description: 'Learning and engagement trends',
    icon: LineChart,
  },
  {
    to: '/admin/videos',
    label: 'Videos',
    description: 'Catalog and transcription operations',
    icon: Video,
  },
  {
    to: '/admin/topic-tags',
    label: 'Topic Tags',
    description: 'Public catalog taxonomy',
    icon: Tags,
  },
  {
    to: '/admin/publish-requests',
    label: 'Publish Review',
    description: 'Moderate user publishing requests',
    icon: SendToBack,
  },
  {
    to: '/admin/transcript-feedback',
    label: 'Feedback',
    description: 'Resolve transcript corrections',
    icon: MessageSquareWarning,
  },
  {
    to: '/admin/users',
    label: 'Users',
    description: 'Accounts, roles, and access',
    icon: Users,
  },
];

export interface AdminPageMeta {
  title: string;
  breadcrumb: string;
  description: string;
}

export function getAdminPageMeta(pathname: string): AdminPageMeta {
  if (/^\/admin\/users\/[^/]+/.test(pathname)) {
    return {
      title: 'User detail',
      breadcrumb: 'Admin / Users / Detail',
      description: 'Account profile, learning metrics, and credentials',
    };
  }

  const item = [...adminNavigation]
    .sort((a, b) => b.to.length - a.to.length)
    .find(({ to, end }) =>
      end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`),
    );

  return {
    title: item?.label ?? 'Admin',
    breadcrumb: item ? `Admin / ${item.label}` : 'Admin',
    description: item?.description ?? 'Administration workspace',
  };
}
