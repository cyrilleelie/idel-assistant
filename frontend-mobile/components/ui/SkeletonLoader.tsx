/**
 * SkeletonLoader — Shimmer-animated skeleton placeholders for list loading.
 *
 * Replaces spinners with a visual preview of the content structure.
 * Supports type-specific layouts matching existing card components.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkeletonType =
  | 'appointment-card'
  | 'patient-card'
  | 'transmission-card'
  | 'preparation-card'
  | 'generic';

interface SkeletonLoaderProps {
  type: SkeletonType;
  count?: number;
  /** Width for 'generic' type (default: '100%') */
  width?: number | string;
  /** Height for 'generic' type (default: 80) */
  height?: number;
}

// ---------------------------------------------------------------------------
// Shimmer block
// ---------------------------------------------------------------------------

function ShimmerBlock({ style }: { style: ViewStyle | ViewStyle[] }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#E2E8F0', '#F1F5F9', '#E2E8F0'],
  });

  return (
    <Animated.View
      style={[styles.shimmerBlock, style, { backgroundColor }]}
      accessibilityElementsHidden
    />
  );
}

// ---------------------------------------------------------------------------
// Card skeletons
// ---------------------------------------------------------------------------

function AppointmentCardSkeleton() {
  return (
    <View style={[styles.card, styles.appointmentCard]}>
      <View style={styles.row}>
        <ShimmerBlock style={{ width: 16, height: 16, borderRadius: 8 }} />
        <ShimmerBlock style={{ width: 100, height: 14, borderRadius: 4, marginLeft: 6 }} />
      </View>
      <ShimmerBlock style={{ width: '70%', height: 16, borderRadius: 4, marginTop: 8 }} />
      <ShimmerBlock style={{ width: '50%', height: 12, borderRadius: 4, marginTop: 6 }} />
    </View>
  );
}

function PatientCardSkeleton() {
  return (
    <View style={[styles.card, styles.patientCard]}>
      <View style={styles.row}>
        <ShimmerBlock style={{ width: 44, height: 44, borderRadius: 22 }} />
        <View style={styles.textGroup}>
          <ShimmerBlock style={{ width: '60%', height: 16, borderRadius: 4 }} />
          <ShimmerBlock style={{ width: '40%', height: 12, borderRadius: 4, marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

function TransmissionCardSkeleton() {
  return (
    <View style={[styles.card, styles.transmissionCard]}>
      <View style={styles.row}>
        <ShimmerBlock style={{ width: 32, height: 32, borderRadius: 16 }} />
        <View style={styles.textGroup}>
          <ShimmerBlock style={{ width: '50%', height: 14, borderRadius: 4 }} />
          <ShimmerBlock style={{ width: '80%', height: 12, borderRadius: 4, marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

function PreparationCardSkeleton() {
  return (
    <View style={[styles.card, styles.preparationCard]}>
      <ShimmerBlock style={{ width: '45%', height: 16, borderRadius: 4 }} />
      <ShimmerBlock style={{ width: '70%', height: 12, borderRadius: 4, marginTop: 8 }} />
      <ShimmerBlock style={{ width: '90%', height: 12, borderRadius: 4, marginTop: 6 }} />
      <ShimmerBlock style={{ width: '30%', height: 10, borderRadius: 4, marginTop: 8 }} />
    </View>
  );
}

function GenericSkeleton({
  width = '100%',
  height = 80,
}: {
  width?: number | string;
  height?: number;
}) {
  return (
    <View style={styles.genericWrapper}>
      <ShimmerBlock style={{ width: width as number, height, borderRadius: 8 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SKELETON_MAP: Record<Exclude<SkeletonType, 'generic'>, React.FC> = {
  'appointment-card': AppointmentCardSkeleton,
  'patient-card': PatientCardSkeleton,
  'transmission-card': TransmissionCardSkeleton,
  'preparation-card': PreparationCardSkeleton,
};

export default function SkeletonLoader({
  type,
  count = 3,
  width,
  height,
}: SkeletonLoaderProps) {
  if (type === 'generic') {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <GenericSkeleton key={i} width={width} height={height} />
        ))}
      </>
    );
  }

  const SkeletonCard = SKELETON_MAP[type];
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  shimmerBlock: {
    backgroundColor: '#E2E8F0',
  },
  card: {
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  appointmentCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.borderLight,
  },
  patientCard: {},
  transmissionCard: {},
  preparationCard: {},
  genericWrapper: {
    marginHorizontal: 16,
    marginVertical: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
    marginLeft: 12,
  },
});
