import 'react-native/Libraries/Core/InitializeCore';
import { registerRootComponent } from 'expo';

import App from './App';
import { initializeErrorTracking, withErrorTracking } from './src/observability/errorTracking';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
initializeErrorTracking();
registerRootComponent(withErrorTracking(App));
