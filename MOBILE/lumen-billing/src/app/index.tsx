import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Loading } from '@/components/ui';
import { useSession } from '@/contexts/session';

// Auth gate — restores the persisted session, then routes to the app or login.
export default function Index() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-night">
        <Loading />
      </View>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/(tabs)' : '/(auth)/login'} />;
}
