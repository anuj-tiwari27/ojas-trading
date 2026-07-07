'use client';
import { ModulePlaceholder } from '@/components/module-placeholder';
export default function UsersPage() {
  return (
    <ModulePlaceholder
      title="Users & Roles"
      description="Role-based access, permission matrix & approvals"
      features={[ 'Users', 'Roles', 'Permission Matrix', 'Branch Restrictions', 'Approval Levels',]}
    />
  );
}
