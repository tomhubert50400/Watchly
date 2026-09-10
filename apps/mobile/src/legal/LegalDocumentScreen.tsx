import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExternalLink } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenReveal } from '../components/ScreenReveal';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { legalDocuments } from './legalDocuments';

type LegalDocumentScreenProps = NativeStackScreenProps<RootStackParamList, 'LegalDocument'>;

export function LegalDocumentScreen({ route }: LegalDocumentScreenProps) {
  const document = legalDocuments[route.params.document];

  return (
    <Screen title="">
      <ScreenReveal delay={0} style={styles.pageIntro}>
        <Text style={styles.updated}>Updated {document.updatedAt}</Text>
        <Text style={styles.intro}>{document.intro}</Text>
      </ScreenReveal>
      <ScreenReveal delay={100} style={styles.sections}>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
            {section.links?.map((link) => (
              <Pressable
                accessibilityHint="Opens in your browser"
                accessibilityRole="link"
                key={link.url}
                onPress={() => void Linking.openURL(link.url)}
                style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
              >
                <Text style={styles.linkLabel}>{link.label}</Text>
                <ExternalLink color={colors.accentText} size={17} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScreenReveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  intro: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 29,
  },
  link: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touchTargets.min,
    paddingRight: spacing.sm,
  },
  linkLabel: {
    color: colors.accentText,
    fontSize: 15,
    fontWeight: '700',
  },
  pageIntro: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  sections: {
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  updated: {
    ...typography.meta,
    color: colors.textSubtle,
    textTransform: 'uppercase',
  },
});
