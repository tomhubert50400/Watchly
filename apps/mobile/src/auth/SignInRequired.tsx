import { useState } from 'react';
import { LogIn } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { ProfileAuthCard } from './ProfileAuthCard';

type SignInContext = {
  body: string;
  title: string;
};

type SignInSheetProps = SignInContext & {
  onClose: () => void;
  visible: boolean;
};

export function SignInSheet({ body, onClose, title, visible }: SignInSheetProps) {
  if (!visible) return null;

  return (
    <BottomActionSheet dragFromHandleOnly onClose={onClose} title="Sign in to Watchly" visible>
      <BottomActionSheetScrollView
        disableScrollViewPanResponder={false}
        contentContainerStyle={styles.sheetContent}
      >
        <ProfileAuthCard body={body} embedded title={title} />
      </BottomActionSheetScrollView>
    </BottomActionSheet>
  );
}

export function SignInRequiredCard({ body, title }: SignInContext) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  return (
    <>
      <View style={styles.promptCard}>
        <View style={styles.iconBadge}>
          <LogIn color={colors.accentText} size={22} strokeWidth={2.2} />
        </View>
        <Text accessibilityRole="header" style={styles.promptTitle}>{title}</Text>
        <Text style={styles.promptBody}>{body}</Text>
        <Button fullWidth label="Sign in here" onPress={() => setIsSignInOpen(true)} />
      </View>
      <SignInSheet
        body={body}
        onClose={() => setIsSignInOpen(false)}
        title={title}
        visible={isSignInOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  promptBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  promptCard: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  promptTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  sheetContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
});
