import { Redirect } from 'expo-router';

// The app opens on the first space; the room home is parked for later
export default function Index() {
  return <Redirect href="/movie" />;
}
