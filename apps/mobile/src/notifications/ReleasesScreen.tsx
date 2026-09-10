import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenReveal } from '../components/ScreenReveal';
import { colors, spacing, touchTargets } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { NotificationsScreen } from './NotificationsScreen';
import { ReleaseCalendarScreen } from './ReleaseCalendarScreen';

type ReleasesScreenProps = NativeStackScreenProps<RootStackParamList, 'ReleaseCalendar' | 'Notifications'>;

export function ReleasesScreen({ navigation, route }: ReleasesScreenProps) {
  const [tab, setTab] = useState<'calendar' | 'alerts'>(route.name === 'Notifications' ? 'alerts' : 'calendar');

  return (
    <View style={styles.screen}>
      <ScreenReveal style={styles.tabs}>
        {(['calendar', 'alerts'] as const).map((value) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.selectedTab]}
          >
            <Text style={[styles.label, tab === value && styles.selectedLabel]}>
              {value === 'calendar' ? 'Release calendar' : 'Alerts'}
            </Text>
          </Pressable>
        ))}
      </ScreenReveal>
      {tab === 'calendar'
        ? <ReleaseCalendarScreen navigation={navigation} />
        : <NotificationsScreen navigation={navigation} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  tabs: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.md },
  tab: { borderBottomWidth: 2, borderBottomColor: 'transparent', justifyContent: 'center', minHeight: touchTargets.min },
  selectedTab: { borderBottomColor: colors.accent },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  selectedLabel: { color: colors.text },
});
