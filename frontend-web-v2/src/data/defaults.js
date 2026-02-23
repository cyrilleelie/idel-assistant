import { formatDate } from '../utils/dateTime';

export const defaultNurses = [
  { id: '1', firstName: 'Alice', lastName: 'Dupont', role: 'Titulaire', phone: '06 12 34 56 78', email: 'alice.d@cabinet.fr', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: '2', firstName: 'Benoît', lastName: 'Martin', role: 'Collaborateur', phone: '06 98 76 54 32', email: 'benoit.m@cabinet.fr', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: '3', firstName: 'Claire', lastName: 'Rousseau', role: 'Remplaçant(e)', phone: '06 55 44 33 22', email: 'claire.r@remplacants.fr', color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

export const defaultConfigs = [
  {
    id: 'c1',
    name: 'Organisation Standard',
    startDate: '2024-01-01',
    slots: [
      { id: 'c1_s1', name: 'Matin', startTime: '06:00', endTime: '13:00' },
      { id: 'c1_s2', name: 'Soir', startTime: '16:00', endTime: '20:00' }
    ]
  }
];

export const defaultPatients = [
  {
    id: 'p1', firstName: 'Jean', lastName: 'DUPONT', phone: '06 11 22 33 44', email: 'jean.dupont@email.com',
    address: '12 Rue de la Paix, 75002 Paris', ssn: '1 80 12 75 123 456 78',
    doctorName: 'Dr. Michel Lefevre', doctorContact: '01 45 67 89 00',
    antecedents: 'Diabète de type 2 (diagnostiqué en 2018)\nHypertension artérielle sous traitement.',
    notes: 'Patient parfois anxieux lors des prises de sang. Prévoir un peu de temps pour rassurer.',
    prescriptions: [
      {
        id: 'rx_demo_1',
        label: 'Injection insuline + glycémie capillaire',
        documents: [],
        startDate: '2026-01-15',
        endDate: '2026-07-15',
        careSchedule: { frequency: '2xday', customFrequency: '', preferredSlot: 'Matin et Soir', notes: 'Glycémie capillaire avant chaque injection. Insuline Lantus 20 UI le matin, Novorapid selon protocole le soir.' }
      },
      {
        id: 'rx_demo_2',
        label: 'Pansement pied droit',
        documents: [],
        startDate: '2026-02-01',
        endDate: '2026-03-15',
        careSchedule: { frequency: '3xweek', customFrequency: '', preferredSlot: 'Matin', notes: 'Plaie diabétique orteil droit. Nettoyage sérum phy + Mépilex Border. Surveiller signes infection.' }
      }
    ]
  },
  {
    id: 'p2', firstName: 'Marie', lastName: 'BERNARD', phone: '06 22 33 44 55', email: '',
    address: '8 Avenue Victor Hugo, 75016 Paris', ssn: '2 55 03 75 234 567 89',
    doctorName: 'Dr. Sophie Garnier', doctorContact: '01 42 56 78 90',
    antecedents: 'Insuffisance cardiaque chronique.\nAnticoagulants (AVK) — INR à surveiller.',
    notes: 'Code porte : 4521B. Habite au 3e sans ascenseur.',
    prescriptions: []
  },
  {
    id: 'p3', firstName: 'Robert', lastName: 'MOREAU', phone: '06 33 44 55 66', email: 'r.moreau@free.fr',
    address: '45 Boulevard Haussmann, 75009 Paris', ssn: '1 42 07 75 345 678 90',
    doctorName: 'Dr. Michel Lefevre', doctorContact: '01 45 67 89 00',
    antecedents: 'BPCO stade 3.\nOxygénothérapie à domicile.',
    notes: 'Passage infirmier matin impératif avant 9h (oxygène). Clé sous le pot de fleurs.',
    prescriptions: []
  },
  {
    id: 'p4', firstName: 'Françoise', lastName: 'PETIT', phone: '06 44 55 66 77', email: '',
    address: '3 Rue des Lilas, 75020 Paris', ssn: '2 38 11 75 456 789 01',
    doctorName: 'Dr. Anne Dubois', doctorContact: '01 43 78 90 12',
    antecedents: 'Alzheimer stade modéré (diagnostiqué 2021).\nChutes fréquentes — prothèse hanche droite 2023.',
    notes: 'Aidante principale : sa fille Nathalie (06 77 88 99 00). Patiente désorientée le matin.',
    prescriptions: []
  },
  {
    id: 'p5', firstName: 'Pierre', lastName: 'LEROY', phone: '06 55 66 77 88', email: 'pierre.leroy@gmail.com',
    address: '22 Rue du Faubourg Saint-Antoine, 75012 Paris', ssn: '1 65 04 75 567 890 12',
    doctorName: 'Dr. Sophie Garnier', doctorContact: '01 42 56 78 90',
    antecedents: 'Diabète de type 1 insulino-dépendant.\nNeuropathie périphérique — soins de pieds.',
    notes: 'Insuline au réfrigérateur, 2e étagère. Patient autonome et coopérant.',
    prescriptions: []
  },
  {
    id: 'p6', firstName: 'Simone', lastName: 'ROUX', phone: '01 45 67 00 11', email: '',
    address: '17 Rue Monge, 75005 Paris', ssn: '2 30 09 75 678 901 23',
    doctorName: 'Dr. Michel Lefevre', doctorContact: '01 45 67 89 00',
    antecedents: 'AVC ischémique (2022) — hémiparésie gauche.\nPansement escarre sacrée.',
    notes: 'Lit médicalisé au salon. Mari présent mais très âgé, ne pas compter sur lui pour la mobilisation.',
    prescriptions: []
  },
  {
    id: 'p7', firstName: 'Ahmed', lastName: 'BENALI', phone: '06 66 77 88 99', email: 'a.benali@outlook.fr',
    address: '5 Place de la République, 75003 Paris', ssn: '1 72 06 75 789 012 34',
    doctorName: 'Dr. Anne Dubois', doctorContact: '01 43 78 90 12',
    antecedents: 'Chirurgie genou droit (LCA) — rééducation en cours.\nPas d\'allergie connue.',
    notes: 'Pansement post-opératoire à changer tous les 2 jours. Très sportif, surveiller la reprise.',
    prescriptions: []
  },
  {
    id: 'p8', firstName: 'Hélène', lastName: 'GARCIA', phone: '06 77 88 99 00', email: '',
    address: '60 Rue de Rivoli, 75004 Paris', ssn: '2 48 12 75 890 123 45',
    doctorName: 'Dr. Sophie Garnier', doctorContact: '01 42 56 78 90',
    antecedents: 'Cancer du sein — chimiothérapie en cours.\nPort-à-cath posé en janvier 2026.',
    notes: 'Rinçage PAC toutes les 4 semaines. Patiente fatiguée, prévoir passage calme.',
    prescriptions: []
  },
  {
    id: 'p9', firstName: 'Michel', lastName: 'THOMAS', phone: '06 88 99 00 11', email: 'michel.thomas@wanadoo.fr',
    address: '33 Rue de Vaugirard, 75006 Paris', ssn: '1 50 02 75 901 234 56',
    doctorName: 'Dr. Michel Lefevre', doctorContact: '01 45 67 89 00',
    antecedents: 'Insuffisance rénale chronique stade 4.\nDialyse péritonéale à domicile.',
    notes: 'Matériel de dialyse dans la chambre du fond. Surveiller poids et tension à chaque passage.',
    prescriptions: []
  },
  {
    id: 'p10', firstName: 'Lucie', lastName: 'LAMBERT', phone: '06 99 00 11 22', email: 'lucie.lambert@gmail.com',
    address: '14 Rue Oberkampf, 75011 Paris', ssn: '2 85 08 75 012 345 67',
    doctorName: 'Dr. Anne Dubois', doctorContact: '01 43 78 90 12',
    antecedents: 'Grossesse à risque (jumeaux) — repos strict.\nDiabète gestationnel.',
    notes: 'Glycémie capillaire + injection insuline matin et soir. Conjoint souvent présent le soir.',
    prescriptions: []
  },
];

const today = formatDate(new Date());
const tomorrow = formatDate(new Date(Date.now() + 86400000));

export const defaultAppointments = [
  { id: 'rdv_1', dateStr: today, slotId: 'c1_s1', nurseId: '1', patientId: 'p1', patient: 'Jean DUPONT', startTime: '07:00', endTime: '07:30' },
  { id: 'rdv_2', dateStr: today, slotId: 'c1_s1', nurseId: '1', patientId: 'p4', patient: 'Françoise PETIT', startTime: '08:00', endTime: '08:45' },
  { id: 'rdv_3', dateStr: today, slotId: 'c1_s1', nurseId: '1', patientId: 'p6', patient: 'Simone ROUX', startTime: '09:00', endTime: '09:30' },
  { id: 'rdv_4', dateStr: today, slotId: 'c1_s1', nurseId: '2', patientId: 'p2', patient: 'Marie BERNARD', startTime: '07:30', endTime: '08:00' },
  { id: 'rdv_5', dateStr: today, slotId: 'c1_s1', nurseId: '2', patientId: 'p5', patient: 'Pierre LEROY', startTime: '08:30', endTime: '09:00' },
  { id: 'rdv_6', dateStr: today, slotId: 'c1_s1', nurseId: '2', patientId: 'p9', patient: 'Michel THOMAS', startTime: '09:30', endTime: '10:00' },
  { id: 'rdv_7', dateStr: today, slotId: 'c1_s2', nurseId: '1', patientId: 'p8', patient: 'Hélène GARCIA', startTime: '17:00', endTime: '17:30' },
  { id: 'rdv_8', dateStr: today, slotId: 'c1_s2', nurseId: '1', patientId: 'p10', patient: 'Lucie LAMBERT', startTime: '18:00', endTime: '18:30' },
  { id: 'rdv_9', dateStr: tomorrow, slotId: 'c1_s1', nurseId: '1', patientId: 'p1', patient: 'Jean DUPONT', startTime: '07:00', endTime: '07:30' },
  { id: 'rdv_10', dateStr: tomorrow, slotId: 'c1_s1', nurseId: '3', patientId: 'p3', patient: 'Robert MOREAU', startTime: '07:30', endTime: '08:00' },
  { id: 'rdv_11', dateStr: tomorrow, slotId: 'c1_s1', nurseId: '3', patientId: 'p7', patient: 'Ahmed BENALI', startTime: '08:30', endTime: '09:00' },
  { id: 'rdv_12', dateStr: tomorrow, slotId: 'c1_s2', nurseId: '2', patientId: 'p10', patient: 'Lucie LAMBERT', startTime: '18:00', endTime: '18:30' },
];

export const nurseColors = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-purple-100 text-purple-800 border-purple-200',
];
