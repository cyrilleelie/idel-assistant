# Checklist de test terrain — Application mobile IDEL Assistant

## Prerequis
- [ ] Build APK Android installe sur un device physique
- [ ] Compte IDEL de test cree sur le backend
- [ ] Backend accessible depuis le reseau mobile
- [ ] Donnees patients et RDV de test creees

## SECURITE
- [ ] Premier login -> configuration PIN (6 chiffres)
- [ ] Proposition biometrie -> activation Face ID / empreinte
- [ ] Verrouillage automatique apres 2 min d'inactivite
- [ ] Deverrouillage par biometrie -> acces immediat
- [ ] Deverrouillage par PIN -> acces immediat
- [ ] 5 echecs PIN consecutifs -> effacement automatique (tester sur device de test uniquement)
- [ ] Captures d'ecran bloquees sur fiche patient (Android)
- [ ] Captures d'ecran bloquees sur transmissions (Android)
- [ ] Captures d'ecran AUTORISEES sur la tournee (planning partageable)
- [ ] Deconnexion -> confirmation -> effacement securise complet
- [ ] Verification : fichiers sur le device sont .enc (chiffres)
- [ ] Verification : base SQLite illisible sans la DEK

## TOURNEE DU JOUR
- [ ] Liste des RDV affichee, triee par heure
- [ ] Statuts visuels corrects (vert=realise, bleu=prochain, gris=a venir)
- [ ] Compteur progression "X RDV - Y realises"
- [ ] Tap "Y aller" -> ouverture GPS externe (Google Maps / Waze)
- [ ] Tap "Realise" -> confirmation -> card passe en vert avec animation
- [ ] Feedback haptique au marquage realise
- [ ] Navigation date : hier / aujourd'hui / demain
- [ ] Pull-to-refresh -> synchronisation
- [ ] Skeleton loading visible pendant le chargement (pas de spinner)

## FICHE PATIENT
- [ ] Liste patients avec recherche instantanee
- [ ] Skeleton loading pendant le chargement
- [ ] Fiche complete : infos, notes, badges BSI/ALD
- [ ] Adresse cliquable -> GPS
- [ ] Telephone cliquable -> composeur
- [ ] Prochains RDV affiches

## SCANNER D'ORDONNANCES
- [ ] Ouverture camera avec cadre guide
- [ ] Capture photo nette
- [ ] Apercu + possibilite d'ajouter des pages
- [ ] Validation -> "Creation du PDF securise..."
- [ ] Feedback haptique apres scan reussi
- [ ] Formulaire rattachement (prescripteur, date)
- [ ] Document visible dans la liste documents du patient
- [ ] Tap "Voir PDF" -> affichage du PDF dechiffre
- [ ] Fichier .enc verifie illisible sur le filesystem

## TRANSMISSIONS VOCALES
- [ ] Enregistrement vocal : tap pour demarrer/arreter
- [ ] Feedback haptique au demarrage de l'enregistrement
- [ ] Compteur de duree affiche
- [ ] Barre de niveau audio animee
- [ ] Apercu : reecoute du fichier chiffre
- [ ] Option "Refaire" -> suppression + recommencer
- [ ] Validation -> "Transmission enregistree" + feedback haptique
- [ ] Historique transmissions : timeline groupee par jour
- [ ] Synthese IA affichee (si disponible)
- [ ] Lecture audio depuis historique

## TRANSMISSION ECRITE
- [ ] Saisie texte avec compteur caracteres
- [ ] Enregistrement -> confirmation

## PREPARATION JOURNEE
- [ ] Onglet Preparer affiche les patients de demain
- [ ] Skeleton loading pendant le chargement (pas de spinner)
- [ ] Syntheses IA affichees pour les patients avec transmissions recentes
- [ ] Alertes mises en evidence
- [ ] "Aucune nouvelle" pour les patients sans changement
- [ ] Depliage des transmissions inline

## FACTURATION
- [ ] Depuis RDV completed -> "Voir la facture"
- [ ] Detail des actes avec montants corrects
- [ ] Montants AMO/AMC/patient corrects
- [ ] "Voir le PDF" -> affichage
- [ ] "Envoyer par email" -> modal -> envoi -> confirmation
- [ ] "Presenter au patient" -> plein ecran -> fermer -> retour normal

## MODE OFFLINE (activer le mode avion)
- [ ] Consultation tournee du jour
- [ ] Consultation fiche patient
- [ ] Marquage RDV realise -> operation en file d'attente
- [ ] Dictee transmission vocale -> sauvegarde locale
- [ ] Scan ordonnance -> sauvegarde locale
- [ ] Consultation documents/PDF deja en cache
- [ ] Retour reseau -> synchronisation automatique
- [ ] Operations en attente traitees

## NOTIFICATIONS
- [ ] Notification annulation RDV recue
- [ ] Notification NE contient PAS de donnees medicales sur ecran verrouille
- [ ] Tap notification -> deverrouillage -> bon ecran
- [ ] Silence nocturne respecte (pas de notif entre 22h-7h)
- [ ] Desactivation d'un type de notification -> plus recue

## PARAMETRES
- [ ] Toutes les sections affichees et fonctionnelles
- [ ] Toggle biometrie on/off
- [ ] Changement delai verrouillage
- [ ] Changement PIN (ancien -> nouveau -> confirmation)
- [ ] Preference GPS modifiable
- [ ] Toggles notifications fonctionnels
- [ ] Taille du cache affichee
- [ ] Forcer la synchronisation
- [ ] Vider le cache local (avec confirmation)

## ACCESSIBILITE
- [ ] VoiceOver/TalkBack : tous les boutons ont un label descriptif
- [ ] Touch targets >= 44x44px sur tous les elements interactifs
- [ ] Contraste texte suffisant (WCAG AA)

## UX POLISH
- [ ] Skeleton screens sur toutes les listes (pas de spinners)
- [ ] Animations fluides sur les transitions de statut
- [ ] Messages d'erreur humains (pas de "Network Error")
- [ ] Etats vides harmonises avec icone + message + action
- [ ] Bouton "Reessayer" sur les ecrans d'erreur
