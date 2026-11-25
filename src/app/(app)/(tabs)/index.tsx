import { StaffQueue } from '../../../features/requests/StaffQueue';
import { TenantHome } from '../../../features/requests/TenantHome';
import { useUser } from '../../../features/auth/AuthProvider';

export default function Home() {
  const { role } = useUser();
  return role === 'tenant' ? <TenantHome /> : <StaffQueue />;
}
