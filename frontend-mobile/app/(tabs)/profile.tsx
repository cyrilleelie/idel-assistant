import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '../../src/hooks/useAuth';
import { theme } from '../../src/utils/colors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <FontAwesome name="user-circle" size={48} color={theme.primary} />
        </View>
        <Text style={styles.name}>
          {user?.first_name} {user?.last_name}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <ProfileRow icon="id-badge" label="RPPS" value={user?.rpps || 'Non renseigne'} />
        <ProfileRow icon="phone" label="Telephone" value={user?.phone || 'Non renseigne'} />
        <ProfileRow icon="building" label="Cabinet" value={user?.cabinet_id ? 'Configure' : 'Non configure'} />
        <ProfileRow icon="shield" label="Role" value={user?.role || 'idel'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application</Text>
        <ProfileRow icon="info-circle" label="Version" value="1.0.0" />
        <ProfileRow icon="server" label="API" value="localhost:8000" />
      </View>

      <Button
        mode="outlined"
        onPress={logout}
        style={styles.logoutButton}
        textColor={theme.error}
        icon="logout"
      >
        Se deconnecter
      </Button>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function ProfileRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={rowStyles.container}>
      <FontAwesome name={icon as any} size={16} color={theme.textSecondary} style={rowStyles.icon} />
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  icon: {
    width: 24,
    textAlign: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    color: theme.textSecondary,
    width: 100,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatar: {
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  email: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  section: {
    backgroundColor: theme.surface,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  logoutButton: {
    margin: 16,
    borderColor: theme.error,
    borderRadius: 8,
  },
});
