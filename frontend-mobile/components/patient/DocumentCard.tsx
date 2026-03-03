/**
 * DocumentCard — Card for the documents list.
 *
 * Shows file type icon, prescriber, date, and upload status badge.
 * React.memo for FlatList performance.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import type { DocumentView } from '@/types/patient';
import { formatFileType } from '@/types/patient';
import { formatDateFrench } from '@/utils/dateHelpers';

interface DocumentCardProps {
  document: DocumentView;
  onPress: (doc: DocumentView) => void;
  onDelete?: (doc: DocumentView) => void;
}

function getFileTypeIcon(fileType: string): React.ComponentProps<typeof Ionicons>['name'] {
  switch (fileType) {
    case 'prescription':
      return 'document-text-outline';
    case 'lab_result':
      return 'flask-outline';
    case 'photo':
      return 'camera-outline';
    case 'scan':
      return 'scan-outline';
    default:
      return 'document-outline';
  }
}

function DocumentCardInner({ document, onPress, onDelete }: DocumentCardProps) {
  const typeLabel = formatFileType(document.fileType);
  const icon = getFileTypeIcon(document.fileType);
  const dateLabel = document.documentDate
    ? formatDateFrench(document.documentDate)
    : null;

  return (
    <Pressable
      onPress={() => onPress(document)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel}${document.prescriberName ? ` de ${document.prescriberName}` : ''}`}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.typeLabel} numberOfLines={1}>
            {typeLabel}
          </Text>
          <Badge
            label={document.uploaded ? 'Synchro' : 'Local'}
            variant={document.uploaded ? 'success' : 'neutral'}
          />
        </View>
        {document.prescriberName != null && (
          <Text style={styles.prescriber} numberOfLines={1}>
            {document.prescriberName}
          </Text>
        )}
        {dateLabel != null && (
          <Text style={styles.date}>{dateLabel}</Text>
        )}
        {document.note != null && (
          <Text style={styles.note} numberOfLines={2}>
            {document.note}
          </Text>
        )}
      </View>

      {/* Delete button */}
      {onDelete != null && (
        <Pressable
          onPress={() => onDelete(document)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Supprimer le document"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </Pressable>
      )}
    </Pressable>
  );
}

const DocumentCard = React.memo(DocumentCardInner);
export default DocumentCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: {
    opacity: 0.92,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  prescriber: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  date: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  note: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 8,
  },
});
