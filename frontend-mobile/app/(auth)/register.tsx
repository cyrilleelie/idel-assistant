import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { AxiosError } from 'axios';
import { useAuth } from '../../src/hooks/useAuth';
import { theme } from '../../src/utils/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [rpps, setRpps] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !rpps.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (rpps.trim().length !== 11) {
      setError('Le numero RPPS doit contenir 11 chiffres');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        rpps: rpps.trim(),
      });
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 409) {
        setError('Un compte existe deja avec cet email');
      } else {
        setError('Erreur lors de l\'inscription. Verifiez votre reseau.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Inscription</Text>
            <Text style={styles.subtitle}>Creez votre compte IDEL</Text>
          </View>

          <TextInput
            label="Prenom"
            value={firstName}
            onChangeText={setFirstName}
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />

          <TextInput
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />

          <TextInput
            label="RPPS (11 chiffres)"
            value={rpps}
            onChangeText={setRpps}
            keyboardType="numeric"
            maxLength={11}
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />

          <TextInput
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor={theme.primary}
          >
            Creer mon compte
          </Button>

          <Button
            mode="text"
            onPress={() => router.back()}
            textColor={theme.primary}
          >
            Deja un compte ? Se connecter
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  input: {
    marginBottom: 12,
    backgroundColor: theme.surface,
  },
  error: {
    color: theme.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
});
