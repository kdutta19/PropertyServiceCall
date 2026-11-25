import { useLocalSearchParams } from 'expo-router';
import { RequestDetailScreen } from '../../../features/requests/RequestDetailScreen';

export default function RequestDetail() {
  const { id, sent } = useLocalSearchParams<{ id: string; sent?: string }>();
  return <RequestDetailScreen key={id} id={id} justSent={sent === '1'} />;
}
