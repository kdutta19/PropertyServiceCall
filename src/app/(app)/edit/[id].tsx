import { useLocalSearchParams } from 'expo-router';
import { EditRequestScreen } from '../../../features/requests/EditRequestScreen';

export default function EditRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditRequestScreen id={id} />;
}
