/**
 * InvoiceActsTable — Displays a table of invoice line items with totals.
 *
 * Shows each act code + label + amount, then a separator, then the total
 * breakdown (AMO, AMC, patient share).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { InvoiceAct } from '@/services/invoiceService';
import { formatAmount } from '@/utils/formatters';
import { Colors } from '@/constants/colors';

interface InvoiceActsTableProps {
  acts: InvoiceAct[];
  totalAmount: number;
  amountAmo: number;
  amountAmc: number;
  amountPatient: number;
}

export default function InvoiceActsTable({
  acts,
  totalAmount,
  amountAmo,
  amountAmc,
  amountPatient,
}: InvoiceActsTableProps) {
  return (
    <View style={styles.container}>
      {/* Line items */}
      {acts.length > 0 ? (
        acts.map((act, idx) => (
          <View key={idx} style={styles.actRow}>
            <View style={styles.actLeft}>
              <Text style={styles.actCode}>{act.code}</Text>
              <Text style={styles.actLabel} numberOfLines={2}>
                {act.label}
              </Text>
            </View>
            <Text style={styles.actAmount}>{formatAmount(act.amount)}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noActs}>
          Detail des actes en cours de chargement...
        </Text>
      )}

      {/* Separator */}
      <View style={styles.separator} />

      {/* Totals */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalAmount}>{formatAmount(totalAmount)}</Text>
      </View>

      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Part AMO (Secu)</Text>
        <Text style={styles.breakdownAmount}>{formatAmount(amountAmo)}</Text>
      </View>

      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Part complementaire</Text>
        <Text style={styles.breakdownAmount}>{formatAmount(amountAmc)}</Text>
      </View>

      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Reste a charge patient</Text>
        <Text
          style={[
            styles.breakdownAmount,
            amountPatient === 0 && styles.amountZero,
          ]}
        >
          {formatAmount(amountPatient)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  actCode: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 60,
  },
  actLabel: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  actAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  noActs: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  separator: {
    height: 2,
    backgroundColor: Colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  breakdownAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  amountZero: {
    color: Colors.success,
  },
});
