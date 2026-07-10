import { Check, LockKeyhole, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../design/tokens';

export type WatchlistOption = {
  containsTitle: boolean;
  id: string;
  itemCount: number;
  key: string;
  kind: 'personal' | 'shared';
  memberCount: number | null;
  name: string;
};

type WatchlistOptionRowProps = {
  isSelected: boolean;
  onPress: () => void;
  option: WatchlistOption;
};

export function WatchlistOptionRow({ isSelected, onPress, option }: WatchlistOptionRowProps) {
  const isShared = option.kind === 'shared';
  const memberCount = option.memberCount ?? 0;

  return (
    <Pressable
      accessibilityHint={isShared ? 'Voting is available after the title is added.' : undefined}
      accessibilityLabel={`${option.name}, ${buildOptionMeta(option)}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isSelected ? styles.rowSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.kindIcon, isSelected ? styles.kindIconSelected : null]}>
        {isShared ? (
          <Users color={isSelected ? colors.accentText : colors.textMuted} size={22} strokeWidth={2} />
        ) : (
          <LockKeyhole color={isSelected ? colors.accentText : colors.textMuted} size={20} strokeWidth={2} />
        )}
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.name}>{option.name}</Text>
          {isShared && memberCount > 0 ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.people}>
              {Array.from({ length: Math.min(memberCount, 3) }).map((_, index) => (
                <View key={index} style={[styles.person, index > 0 ? styles.personOverlap : null]} />
              ))}
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>{buildOptionMeta(option)}</Text>
      </View>

      <View style={[styles.check, isSelected ? styles.checkSelected : null]}>
        {isSelected ? <Check color={colors.textOnAccent} size={18} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

function buildOptionMeta(option: WatchlistOption) {
  const titleCount = `${option.itemCount} ${option.itemCount === 1 ? 'title' : 'titles'}`;

  if (option.kind === 'personal') {
    return `Private · ${titleCount}`;
  }

  const memberCount = option.memberCount ?? 0;
  return `Shared · ${memberCount} ${memberCount === 1 ? 'member' : 'members'} · ${titleCount}`;
}

const styles = StyleSheet.create({
  check: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  checkSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  kindIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  kindIconSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  meta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 3,
  },
  name: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
    fontWeight: '800',
  },
  people: {
    flexDirection: 'row',
    marginLeft: spacing.sm,
  },
  person: {
    backgroundColor: colors.secondary,
    borderColor: colors.panel,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  personOverlap: {
    marginLeft: -5,
  },
  pressed: {
    opacity: 0.78,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 74,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
