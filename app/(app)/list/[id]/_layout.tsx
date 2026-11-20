import { Stack, useLocalSearchParams } from 'expo-router';
import { ListProvider } from '@/lib/ListStore';
import { C } from '@/theme';

// The list screen and its Add screen share one live store.
export default function ListLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ListProvider listId={id}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.ground } }}>
        <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </ListProvider>
  );
}
