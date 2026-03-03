/**
 * Development seed for WatermelonDB.
 *
 * Populates the local database with realistic Lyon-area data for
 * development and testing. The seed is idempotent: it checks for
 * existing appointments for today before writing anything.
 *
 * This module is dynamically imported by DatabaseProvider only when
 * __DEV__ is true, so it is excluded from production bundles.
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { getTodayString, addDays } from '@/utils/dateHelpers';

// ---------------------------------------------------------------------------
// Patient seed data
// ---------------------------------------------------------------------------

interface PatientSeed {
  serverId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string;
  lat: number;
  lon: number;
  birthDate: string | null;
  isAld: boolean;
  hasActiveBsi: boolean;
  bsiLevel: string | null;
}

const PATIENTS: PatientSeed[] = [
  {
    serverId: 'seed-patient-1',
    firstName: 'Marguerite',
    lastName: 'Bertrand',
    phone: '06 12 34 56 78',
    email: 'm.bertrand@email.fr',
    address: '12 Rue de la République, 69001 Lyon',
    lat: 45.7677,
    lon: 4.8340,
    birthDate: '1938-04-12',
    isAld: true,
    hasActiveBsi: true,
    bsiLevel: 'BSI 2',
  },
  {
    serverId: 'seed-patient-2',
    firstName: 'Pierre',
    lastName: 'Moreau',
    phone: '07 98 76 54 32',
    email: null,
    address: '45 Avenue Jean Jaurès, 69007 Lyon',
    lat: 45.7486,
    lon: 4.8390,
    birthDate: '1952-11-03',
    isAld: false,
    hasActiveBsi: false,
    bsiLevel: null,
  },
  {
    serverId: 'seed-patient-3',
    firstName: 'Simone',
    lastName: 'Lefebvre',
    phone: '06 55 44 33 22',
    email: 'simone.lefebvre@orange.fr',
    address: '8 Place Bellecour, 69002 Lyon',
    lat: 45.7578,
    lon: 4.8320,
    birthDate: '1941-07-22',
    isAld: true,
    hasActiveBsi: true,
    bsiLevel: 'BSI 3',
  },
  {
    serverId: 'seed-patient-4',
    firstName: 'Henri',
    lastName: 'Durand',
    phone: null,
    email: null,
    address: '27 Rue de Créqui, 69006 Lyon',
    lat: 45.7635,
    lon: 4.8498,
    birthDate: '1960-02-14',
    isAld: false,
    hasActiveBsi: false,
    bsiLevel: null,
  },
  {
    serverId: 'seed-patient-5',
    firstName: 'Yvette',
    lastName: 'Renard',
    phone: '06 11 22 33 44',
    email: null,
    address: '3 Rue Garibaldi, 69003 Lyon',
    lat: 45.7555,
    lon: 4.8460,
    birthDate: '1945-09-30',
    isAld: true,
    hasActiveBsi: false,
    bsiLevel: null,
  },
];

// ---------------------------------------------------------------------------
// Document seed shapes
// ---------------------------------------------------------------------------

interface DocumentSeed {
  serverId: string;
  patientIndex: number;
  fileType: string;
  prescriberName: string | null;
  documentDate: string;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Transmission seed shapes
// ---------------------------------------------------------------------------

interface TransmissionSeed {
  serverId: string;
  patientIndex: number;
  /** Index into created appointments array, or null for no appointment */
  appointmentIndex: number | null;
  authorName: string;
  /** If true, use userId param; otherwise use a different author */
  isCurrentUser: boolean;
  contentText: string | null;
  contentStructured: string | null;
  audioFilePath: string | null;
  status: string;
  audioUploaded: boolean;
  /** Offset in days from today (0=today, -1=yesterday, -2=day before yesterday) */
  dayOffset: number;
  /** Offset in hours from midnight for created_at */
  hourOffset: number;
}

// ---------------------------------------------------------------------------
// Appointment seed shapes
// ---------------------------------------------------------------------------

interface AppointmentSeed {
  serverId: string;
  patientIndex: number; // 0-based index into PATIENTS
  date: string;
  startTime: string;
  endTime: string;
  careTypeCode: string;
  careTypeLabel: string;
  locationType: string;
  status: string;
  sortOrder: number;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

/**
 * Module-level lock: prevents concurrent execution from React Strict Mode
 * double-invoking useEffect. The first call captures the promise; the second
 * call returns early because `_seedPromise` is still truthy.
 */
let _seedPromise: Promise<void> | null = null;

/**
 * Populates the local WatermelonDB database with dev seed data.
 *
 * @param database  - WatermelonDB instance
 * @param userId    - The logged-in user's ID (used as user_id on appointments)
 *
 * Guards:
 * - Returns immediately in production (__DEV__ === false)
 * - Returns immediately if a seed is already running (React Strict Mode)
 * - Returns immediately if appointments already exist for today (idempotent)
 */
export async function runDevSeed(database: Database, userId?: string): Promise<void> {
  if (!__DEV__) return;
  if (_seedPromise) return _seedPromise;

  _seedPromise = _runDevSeedImpl(database, userId).finally(() => {
    _seedPromise = null;
  });
  return _seedPromise;
}

async function _runDevSeedImpl(database: Database, userId?: string): Promise<void> {
  const today = getTodayString();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  // Idempotency guard: bail out if we already have data for today for this user
  const todayCount = await database
    .get('appointments')
    .query(
      Q.and(
        Q.where('date', today),
        ...(userId ? [Q.where('user_id', userId)] : []),
      ),
    )
    .fetchCount();

  if (todayCount > 0) return;

  const now = Date.now();

  // Build appointment seeds using date variables
  const appointmentSeeds: AppointmentSeed[] = [
    // --- TODAY: 3 completed ---
    {
      serverId: 'seed-appt-today-1',
      patientIndex: 0,
      date: today,
      startTime: '08:00',
      endTime: '08:30',
      careTypeCode: 'BSI',
      careTypeLabel: 'BSI',
      locationType: 'home',
      status: 'completed',
      sortOrder: 1,
      notes: 'Patiente coopérative, plaies en bonne évolution.',
    },
    {
      serverId: 'seed-appt-today-2',
      patientIndex: 1,
      date: today,
      startTime: '08:45',
      endTime: '09:05',
      careTypeCode: 'AMI 1',
      careTypeLabel: 'AMI 1',
      locationType: 'home',
      status: 'completed',
      sortOrder: 2,
      notes: null,
    },
    {
      serverId: 'seed-appt-today-3',
      patientIndex: 2,
      date: today,
      startTime: '09:15',
      endTime: '09:45',
      careTypeCode: 'Pansement',
      careTypeLabel: 'Pansement',
      locationType: 'home',
      status: 'completed',
      sortOrder: 3,
      notes: 'Pansement refait. RAS.',
    },
    // --- TODAY: 4 scheduled ---
    {
      serverId: 'seed-appt-today-4',
      patientIndex: 3,
      date: today,
      startTime: '10:00',
      endTime: '10:30',
      careTypeCode: 'AMI 1.5',
      careTypeLabel: 'AMI 1.5',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 4,
      notes: null,
    },
    {
      serverId: 'seed-appt-today-5',
      patientIndex: 4,
      date: today,
      startTime: '10:30',
      endTime: '11:00',
      careTypeCode: 'BSI',
      careTypeLabel: 'BSI',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 5,
      notes: null,
    },
    {
      serverId: 'seed-appt-today-6',
      patientIndex: 0,
      date: today,
      startTime: '14:00',
      endTime: '14:30',
      careTypeCode: 'Injection',
      careTypeLabel: 'Injection',
      locationType: 'office',
      status: 'scheduled',
      sortOrder: 6,
      notes: 'Insuline Lantus 20UI.',
    },
    {
      serverId: 'seed-appt-today-7',
      patientIndex: 2,
      date: today,
      startTime: '16:00',
      endTime: '16:30',
      careTypeCode: 'AMI 1',
      careTypeLabel: 'AMI 1',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 7,
      notes: null,
    },
    // --- TODAY: 1 canceled ---
    {
      serverId: 'seed-appt-today-8',
      patientIndex: 3,
      date: today,
      startTime: '15:00',
      endTime: '15:30',
      careTypeCode: 'Pansement',
      careTypeLabel: 'Pansement',
      locationType: 'home',
      status: 'canceled',
      sortOrder: 8,
      notes: 'Annulé par le patient.',
    },
    // --- TOMORROW: 5 scheduled ---
    {
      serverId: 'seed-appt-tomorrow-1',
      patientIndex: 1,
      date: tomorrow,
      startTime: '08:30',
      endTime: '09:00',
      careTypeCode: 'AMI 1',
      careTypeLabel: 'AMI 1',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 1,
      notes: null,
    },
    {
      serverId: 'seed-appt-tomorrow-2',
      patientIndex: 2,
      date: tomorrow,
      startTime: '09:15',
      endTime: '09:45',
      careTypeCode: 'BSI',
      careTypeLabel: 'BSI',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 2,
      notes: null,
    },
    {
      serverId: 'seed-appt-tomorrow-3',
      patientIndex: 4,
      date: tomorrow,
      startTime: '10:00',
      endTime: '10:20',
      careTypeCode: 'Injection',
      careTypeLabel: 'Injection',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 3,
      notes: null,
    },
    {
      serverId: 'seed-appt-tomorrow-4',
      patientIndex: 0,
      date: tomorrow,
      startTime: '11:00',
      endTime: '11:30',
      careTypeCode: 'Pansement',
      careTypeLabel: 'Pansement',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 4,
      notes: null,
    },
    {
      serverId: 'seed-appt-tomorrow-5',
      patientIndex: 3,
      date: tomorrow,
      startTime: '14:00',
      endTime: '14:30',
      careTypeCode: 'AMI 1.5',
      careTypeLabel: 'AMI 1.5',
      locationType: 'home',
      status: 'scheduled',
      sortOrder: 5,
      notes: null,
    },
    // --- YESTERDAY: 2 completed, 1 canceled ---
    {
      serverId: 'seed-appt-yesterday-1',
      patientIndex: 0,
      date: yesterday,
      startTime: '08:00',
      endTime: '08:30',
      careTypeCode: 'BSI',
      careTypeLabel: 'BSI',
      locationType: 'home',
      status: 'completed',
      sortOrder: 1,
      notes: null,
    },
    {
      serverId: 'seed-appt-yesterday-2',
      patientIndex: 3,
      date: yesterday,
      startTime: '09:00',
      endTime: '09:30',
      careTypeCode: 'AMI 1.5',
      careTypeLabel: 'AMI 1.5',
      locationType: 'home',
      status: 'completed',
      sortOrder: 2,
      notes: null,
    },
    {
      serverId: 'seed-appt-yesterday-3',
      patientIndex: 4,
      date: yesterday,
      startTime: '10:30',
      endTime: '11:00',
      careTypeCode: 'Pansement',
      careTypeLabel: 'Pansement',
      locationType: 'home',
      status: 'canceled',
      sortOrder: 3,
      notes: 'Hospitalisation d\'urgence.',
    },
  ];

  // Document seeds
  const documentSeeds: DocumentSeed[] = [
    // Patient 0 (Marguerite Bertrand) — ALD + BSI
    {
      serverId: 'seed-doc-1',
      patientIndex: 0,
      fileType: 'prescription',
      prescriberName: 'Dr. Martin',
      documentDate: addDays(today, -30),
      note: 'Renouvellement ordonnance insuline Lantus 20UI.',
    },
    {
      serverId: 'seed-doc-2',
      patientIndex: 0,
      fileType: 'lab_result',
      prescriberName: 'Labo Biolyss',
      documentDate: addDays(today, -15),
      note: 'HbA1c 7.2% — objectif atteint.',
    },
    {
      serverId: 'seed-doc-3',
      patientIndex: 0,
      fileType: 'prescription',
      prescriberName: 'Dr. Martin',
      documentDate: addDays(today, -7),
      note: 'BSI renouvellement 6 mois.',
    },
    // Patient 1 (Pierre Moreau)
    {
      serverId: 'seed-doc-4',
      patientIndex: 1,
      fileType: 'prescription',
      prescriberName: 'Dr. Dupont',
      documentDate: addDays(today, -20),
      note: null,
    },
    // Patient 2 (Simone Lefebvre) — ALD + BSI 3
    {
      serverId: 'seed-doc-5',
      patientIndex: 2,
      fileType: 'prescription',
      prescriberName: 'Dr. Leroy',
      documentDate: addDays(today, -10),
      note: 'Pansement quotidien ulcere veineux.',
    },
    {
      serverId: 'seed-doc-6',
      patientIndex: 2,
      fileType: 'lab_result',
      prescriberName: 'Labo Cerba',
      documentDate: addDays(today, -5),
      note: null,
    },
    // Patient 3 (Henri Durand)
    {
      serverId: 'seed-doc-7',
      patientIndex: 3,
      fileType: 'prescription',
      prescriberName: 'Dr. Petit',
      documentDate: addDays(today, -14),
      note: 'AMI 1.5 — 3x/semaine.',
    },
    // Patient 4 (Yvette Renard)
    {
      serverId: 'seed-doc-8',
      patientIndex: 4,
      fileType: 'prescription',
      prescriberName: 'Dr. Bernard',
      documentDate: addDays(today, -25),
      note: null,
    },
    {
      serverId: 'seed-doc-9',
      patientIndex: 4,
      fileType: 'other',
      prescriberName: null,
      documentDate: addDays(today, -3),
      note: 'Carte mutuelle scannee.',
    },
  ];

  // Transmission seeds
  const transmissionSeeds: TransmissionSeed[] = [
    // 1. Vocale transcrite (hier, patient 0, appt yesterday-1) — status transcribed
    {
      serverId: 'seed-tx-1',
      patientIndex: 0,
      appointmentIndex: 12, // seed-appt-yesterday-1 is at index 12
      authorName: 'Marie Dupont',
      isCurrentUser: true,
      contentText: 'Patiente stable ce matin. Glycemie a jeun 1.12 g/L, dans les objectifs. Injection Lantus 20UI realisee sans difficulte. Pas de signe d\'hypoglycemie. Prochaine visite demain matin.',
      contentStructured: JSON.stringify({
        synthese: 'Patiente diabetique stable, glycemie dans les objectifs.',
        soins: 'Injection Lantus 20UI sous-cutanee abdomen.',
        constantes: 'Glycemie a jeun : 1.12 g/L. TA : 13/8.',
        observations: 'Pas de signe d\'hypoglycemie. Bonne compliance au traitement.',
        actions: 'Poursuivre le traitement. Controler glycemie demain.',
      }),
      audioFilePath: null, // No real audio file in dev
      status: 'transcribed',
      audioUploaded: true,
      dayOffset: -1,
      hourOffset: 9,
    },
    // 2. Vocale pending (aujourd'hui, patient 2, appt today-3) — status pending_transcription
    {
      serverId: 'seed-tx-2',
      patientIndex: 2,
      appointmentIndex: 2, // seed-appt-today-3 is at index 2
      authorName: 'Marie Dupont',
      isCurrentUser: true,
      contentText: null,
      contentStructured: null,
      audioFilePath: null, // Would be a real path in production
      status: 'pending_transcription',
      audioUploaded: false,
      dayOffset: 0,
      hourOffset: 10,
    },
    // 3. Ecrite validated (avant-hier, patient 0, no appt, autre auteur)
    {
      serverId: 'seed-tx-3',
      patientIndex: 0,
      appointmentIndex: null,
      authorName: 'Sophie Martin',
      isCurrentUser: false,
      contentText: 'Visite de controle. Mme Bertrand se plaint de douleurs articulaires aux genoux, plus marquees le matin au reveil. Mobilite conservee mais limitee. Pas de signe inflammatoire visible. A signaler au Dr Martin lors du prochain RDV.',
      contentStructured: null,
      audioFilePath: null,
      status: 'validated',
      audioUploaded: false,
      dayOffset: -2,
      hourOffset: 14,
    },
    // 4. Vocale transcrite validated (hier, patient 3, appt yesterday-2)
    {
      serverId: 'seed-tx-4',
      patientIndex: 3,
      appointmentIndex: 13, // seed-appt-yesterday-2 is at index 13
      authorName: 'Marie Dupont',
      isCurrentUser: true,
      contentText: 'Soins realises chez M. Durand. Pansement refait, plaie propre en voie de cicatrisation. Le patient signale des demangeaisons autour de la plaie, signe de cicatrisation normal.',
      contentStructured: JSON.stringify({
        synthese: 'Plaie en bonne evolution, demangeaisons pericicatricielles normales.',
        soins: 'Refection pansement : nettoyage serum phy, Mepilex Border 10x10.',
        constantes: 'TA : 12/7. Pouls : 72 bpm.',
        observations: 'Plaie propre, bourgeonnement actif. Demangeaisons pericicatricielles.',
        actions: 'Prochain pansement dans 2 jours. Surveiller signes infection.',
      }),
      audioFilePath: null,
      status: 'validated',
      audioUploaded: true,
      dayOffset: -1,
      hourOffset: 10,
    },
    // 5. Draft (aujourd'hui, patient 4) — status draft
    {
      serverId: 'seed-tx-5',
      patientIndex: 4,
      appointmentIndex: null,
      authorName: 'Marie Dupont',
      isCurrentUser: true,
      contentText: 'Passage chez Mme Renard. A completer...',
      contentStructured: null,
      audioFilePath: null,
      status: 'draft',
      audioUploaded: false,
      dayOffset: 0,
      hourOffset: 11,
    },
    // --- M5 seeds: colleague transmissions for preparation screen ---
    // 6. Colleague transmission for patient 0 (Marguerite Bertrand) — yesterday
    //    with alert about peri-lesional redness
    {
      serverId: 'seed-tx-6',
      patientIndex: 0,
      appointmentIndex: null,
      authorName: 'Marie Collegue',
      isCurrentUser: false,
      contentText: 'Passage du soir chez Mme Bertrand. Pansement refait. Legere rougeur peri-lesionnelle autour de l\'escarre sacrum, a surveiller. Bourgeonnement toujours actif. Patiente en bon etat general.',
      contentStructured: JSON.stringify({
        synthese: 'Evolution favorable de l\'escarre sacrum, bourgeonnement confirme. Legere rougeur peri-lesionnelle a surveiller.',
        soins: 'Refection pansement escarre sacrum : nettoyage serum physiologique, Aquacel Ag+ 10x10.',
        constantes: 'TA : 12/8. Temperature : 36.8°C. Pouls : 68 bpm.',
        observations: 'Bourgeonnement actif, bon tissu de granulation. Legere rougeur peri-lesionnelle signale — pas de signe infectieux franc.',
        actions: 'Surveiller rougeur peri-lesionnelle. Signaler au Dr Martin si extension. Prochain pansement demain.',
      }),
      audioFilePath: null,
      status: 'validated',
      audioUploaded: false,
      dayOffset: -1,
      hourOffset: 18,
    },
    // 7. Colleague transmission for patient 0 (Marguerite Bertrand) — day before yesterday
    {
      serverId: 'seed-tx-7',
      patientIndex: 0,
      appointmentIndex: null,
      authorName: 'Marie Collegue',
      isCurrentUser: false,
      contentText: 'Soins du soir. Glycemie post-prandiale 1.45 g/L, legerement elevee. Injection Lantus 20UI realisee. Patiente signale fatigue inhabituelle.',
      contentStructured: JSON.stringify({
        synthese: 'Glycemie post-prandiale legerement elevee. Patiente fatiguee.',
        soins: 'Injection Lantus 20UI. Controle glycemique.',
        constantes: 'Glycemie post-prandiale : 1.45 g/L. TA : 13/8.',
        observations: 'Fatigue inhabituelle signalee par la patiente. Appetit conserve.',
        actions: 'Surveiller glycemie. Signaler fatigue au medecin si persistante.',
      }),
      audioFilePath: null,
      status: 'validated',
      audioUploaded: false,
      dayOffset: -2,
      hourOffset: 19,
    },
    // 8. Current user transmission for patient 2 (Simone Lefebvre) — yesterday
    //    with structured content — preparation should show this
    {
      serverId: 'seed-tx-8',
      patientIndex: 2,
      appointmentIndex: null,
      authorName: 'Marie Dupont',
      isCurrentUser: true,
      contentText: 'Pansement ulcere veineux refait. Bonne evolution, pas de signe infectieux. Compression remise en place.',
      contentStructured: JSON.stringify({
        synthese: 'Ulcere veineux en bonne evolution. Pansement et compression refaits.',
        soins: 'Refection pansement ulcere veineux jambe gauche : nettoyage, Urgotul, bande de compression.',
        constantes: 'TA : 14/9. Pouls : 76 bpm.',
        observations: 'Bords de plaie bien delimites, pas d\'odeur, pas de signe infectieux.',
        actions: 'Continuer pansements quotidiens. Prochain controle medical dans 1 semaine.',
      }),
      audioFilePath: null,
      status: 'validated',
      audioUploaded: false,
      dayOffset: -1,
      hourOffset: 10,
    },
    // 9. Colleague transmission for patient 3 (Henri Durand) — today, no structured content yet
    //    This patient had no recent transmissions from the current user's perspective
    {
      serverId: 'seed-tx-9',
      patientIndex: 3,
      appointmentIndex: null,
      authorName: 'Marie Collegue',
      isCurrentUser: false,
      contentText: 'Passage chez M. Durand. Pansement propre, pas de probleme signale. Patient en forme.',
      contentStructured: null,
      audioFilePath: null,
      status: 'transcribed',
      audioUploaded: false,
      dayOffset: 0,
      hourOffset: 15,
    },
  ];

  await database.write(async () => {
    // Create patients first and collect their local WatermelonDB IDs
    const patientLocalIds: string[] = [];

    for (const seed of PATIENTS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patient = await database.get('patients').create((record: any) => {
        record._raw.server_id = seed.serverId;
        record._raw.first_name = seed.firstName;
        record._raw.last_name = seed.lastName;
        record._raw.phone = seed.phone ?? null;
        record._raw.address = seed.address;
        record._raw.lat = seed.lat;
        record._raw.lon = seed.lon;
        record._raw.birth_date = seed.birthDate ?? null;
        record._raw.status = 'active';
        record._raw.is_ald = seed.isAld ? 1 : 0;
        record._raw.has_active_bsi = seed.hasActiveBsi ? 1 : 0;
        record._raw.bsi_level = seed.bsiLevel ?? null;
        record._raw.bsi_end_date = null;
        record._raw.notes = null;
        record._raw.email = seed.email ?? null;
        record._raw.last_synced_at = now;
      });
      patientLocalIds.push((patient as { id: string }).id);
    }

    // Create appointments using the local patient IDs and collect their IDs
    const appointmentLocalIds: string[] = [];
    for (const seed of appointmentSeeds) {
      const patientLocalId = patientLocalIds[seed.patientIndex];
      if (!patientLocalId) {
        appointmentLocalIds.push('');
        continue;
      }

      const isCompleted = seed.status === 'completed';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appt = await database.get('appointments').create((record: any) => {
        record._raw.server_id = seed.serverId;
        record._raw.patient_id = patientLocalId;
        record._raw.user_id = userId ?? 'seed-user-1';
        record._raw.date = seed.date;
        record._raw.start_time = seed.startTime;
        record._raw.end_time = seed.endTime;
        record._raw.care_type_code = seed.careTypeCode;
        record._raw.care_type_label = seed.careTypeLabel;
        record._raw.status = seed.status;
        record._raw.location_type = seed.locationType;
        record._raw.notes = seed.notes ?? null;
        record._raw.sort_order = seed.sortOrder;
        record._raw.completed_at = isCompleted ? now - 60_000 : null;
        record._raw.last_synced_at = now;
      });
      appointmentLocalIds.push((appt as { id: string }).id);
    }

    // Create documents using the local patient IDs
    for (const seed of documentSeeds) {
      const patientLocalId = patientLocalIds[seed.patientIndex];
      if (!patientLocalId) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await database.get('documents').create((record: any) => {
        record._raw.server_id = seed.serverId;
        record._raw.patient_id = patientLocalId;
        record._raw.prescription_id = null;
        record._raw.file_type = seed.fileType;
        record._raw.local_file_path = '';
        record._raw.uploaded = false;
        record._raw.prescriber_name = seed.prescriberName ?? null;
        record._raw.document_date = seed.documentDate;
        record._raw.note = seed.note ?? null;
        record._raw.created_at = now;
        record._raw.last_synced_at = now;
      });
    }

    // Create transmissions using the local patient and appointment IDs
    for (const seed of transmissionSeeds) {
      const patientLocalId = patientLocalIds[seed.patientIndex];
      if (!patientLocalId) continue;

      const appointmentLocalId =
        seed.appointmentIndex != null ? appointmentLocalIds[seed.appointmentIndex] || null : null;

      const createdAtDate = new Date(`${addDays(today, seed.dayOffset)}T00:00:00`);
      createdAtDate.setHours(seed.hourOffset);
      const createdAt = createdAtDate.getTime();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await database.get('transmissions').create((record: any) => {
        record._raw.server_id = seed.serverId;
        record._raw.patient_id = patientLocalId;
        record._raw.appointment_id = appointmentLocalId;
        record._raw.author_user_id = seed.isCurrentUser ? (userId ?? 'seed-user-1') : 'seed-other-user';
        record._raw.author_name = seed.authorName;
        record._raw.content_text = seed.contentText ?? null;
        record._raw.content_structured = seed.contentStructured ?? null;
        record._raw.audio_file_path = seed.audioFilePath ?? null;
        record._raw.status = seed.status;
        record._raw.audio_uploaded = seed.audioUploaded ? 1 : 0;
        record._raw.created_at = createdAt;
        record._raw.last_synced_at = now;
      });
    }

    // Create invoices for completed appointments
    const invoiceSeeds: {
      serverId: string;
      appointmentIndex: number;
      patientIndex: number;
      invoiceNumber: string;
      totalAmount: number;
      amountAmo: number;
      amountAmc: number;
      amountPatient: number;
      status: string;
      vitaleStatus: string;
    }[] = [
      {
        serverId: 'seed-invoice-1',
        appointmentIndex: 0, // seed-appt-today-1 — BSI completed, Mme Bertrand (ALD)
        patientIndex: 0,
        invoiceNumber: '2026-03-0042',
        totalAmount: 25.75,
        amountAmo: 25.75,
        amountAmc: 0,
        amountPatient: 0,
        status: 'validated',
        vitaleStatus: 'not_read',
      },
      {
        serverId: 'seed-invoice-2',
        appointmentIndex: 1, // seed-appt-today-2 — AMI 1 completed, M. Moreau
        patientIndex: 1,
        invoiceNumber: '2026-03-0041',
        totalAmount: 7.95,
        amountAmo: 5.57,
        amountAmc: 1.79,
        amountPatient: 0.59,
        status: 'validated',
        vitaleStatus: 'not_read',
      },
      {
        serverId: 'seed-invoice-3',
        appointmentIndex: 2, // seed-appt-today-3 — Pansement completed, Mme Lefebvre
        patientIndex: 2,
        invoiceNumber: '2026-03-0040',
        totalAmount: 35.50,
        amountAmo: 24.85,
        amountAmc: 7.10,
        amountPatient: 3.55,
        status: 'draft',
        vitaleStatus: 'not_read',
      },
    ];

    for (const seed of invoiceSeeds) {
      const patientLocalId = patientLocalIds[seed.patientIndex];
      const appointmentLocalId = appointmentLocalIds[seed.appointmentIndex];
      if (!patientLocalId || !appointmentLocalId) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await database.get('invoices').create((record: any) => {
        record._raw.server_id = seed.serverId;
        record._raw.appointment_id = appointmentLocalId;
        record._raw.patient_id = patientLocalId;
        record._raw.invoice_number = seed.invoiceNumber;
        record._raw.total_amount = seed.totalAmount;
        record._raw.amount_amo = seed.amountAmo;
        record._raw.amount_amc = seed.amountAmc;
        record._raw.amount_patient = seed.amountPatient;
        record._raw.status = seed.status;
        record._raw.pdf_local_path = null;
        record._raw.vitale_status = seed.vitaleStatus;
        record._raw.created_at = now;
        record._raw.last_synced_at = now;
      });
    }
  });
}
