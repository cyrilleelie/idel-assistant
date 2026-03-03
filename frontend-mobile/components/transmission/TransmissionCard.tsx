/**
 * TransmissionCard — Card display for a single transmission in list views.
 *
 * Adapts display based on status:
 * - pending_transcription: waiting message + listen button (if audio local)
 * - transcribed: AI synthesis + details + Listen/Correct buttons
 * - validated: like transcribed but no Correct button
 * - draft: truncated text (3 lines) + View full button
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TransmissionView } from '@/types/transmission';
import { formatTransmissionStatus, formatTransmissionTime } from '@/types/transmission';
import { Colors } from '@/constants/colors';

interface TransmissionCardProps {
  transmission: TransmissionView;
  isCurrentUser: boolean;
  onPlay?: () => void;
  onViewFull?: () => void;
  onEdit?: () => void;
}

export default React.memo(function TransmissionCard({
  transmission,
  isCurrentUser,
  onPlay,
  onViewFull,
  onEdit,
}: TransmissionCardProps) {
  const { status, contentText, contentStructured, audioFilePath, authorName, createdAt } = transmission;
  const isVocal = audioFilePath != null;
  const time = formatTransmissionTime(createdAt);

  return (
    <Pressable
      onPress={onViewFull}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      {/* Header: icon + time + author */}
      <View style={styles.header}>
        <Ionicons
          name={isVocal ? 'mic-outline' : 'create-outline'}
          size={16}
          color={Colors.textSecondary}
        />
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.author}>
          {authorName}
          {isCurrentUser && ' (vous)'}
        </Text>
        <View style={[styles.statusBadge, statusBadgeColor(status)]}>
          <Text style={styles.statusText}>{formatTransmissionStatus(status)}</Text>
        </View>
      </View>

      {/* Body: depends on status */}
      {status === 'pending_transcription' && (
        <View style={styles.body}>
          <Text style={styles.pendingText}>
            Transcription en cours de traitement...
          </Text>
        </View>
      )}

      {(status === 'transcribed' || status === 'validated') && (
        <View style={styles.body}>
          {contentStructured ? (
            <>
              <Text style={styles.syntheseLabel}>Synthese IA</Text>
              <Text style={styles.syntheseText} numberOfLines={3}>
                {contentStructured.synthese}
              </Text>
            </>
          ) : contentText ? (
            <Text style={styles.contentText} numberOfLines={3}>
              {contentText}
            </Text>
          ) : null}
        </View>
      )}

      {status === 'draft' && contentText && (
        <View style={styles.body}>
          <Text style={styles.contentText} numberOfLines={3}>
            {contentText}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {(audioFilePath != null || status === 'pending_transcription') && onPlay && (
          <ActionButton icon="play-circle-outline" label="Ecouter" onPress={onPlay} />
        )}
        {status === 'transcribed' && isCurrentUser && onEdit && (
          <ActionButton icon="pencil-outline" label="Corriger" onPress={onEdit} />
        )}
        {onViewFull && (
          <ActionButton icon="open-outline" label="Voir" onPress={onViewFull} />
        )}
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      hitSlop={4}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={14} color={Colors.primary} />
      <Text style={styles.actionBtnText}>{label}</Text>
    </Pressable>
  );
}

function statusBadgeColor(status: string) {
  switch (status) {
    case 'validated':
      return { backgroundColor: Colors.successLight };
    case 'transcribed':
      return { backgroundColor: Colors.primaryUltraLight };
    case 'pending_transcription':
      return { backgroundColor: Colors.warningLight };
    case 'draft':
      return { backgroundColor: Colors.borderLight };
    default:
      return { backgroundColor: Colors.borderLight };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  cardPressed: {
    backgroundColor: Colors.borderLight,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  author: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  // Body
  body: {
    gap: 4,
  },
  pendingText: {
    fontSize: 13,
    color: Colors.warning,
    fontStyle: 'italic',
  },
  syntheseLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  syntheseText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  contentText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionBtnPressed: {
    backgroundColor: Colors.primaryUltraLight,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
