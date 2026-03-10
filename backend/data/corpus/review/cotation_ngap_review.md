# Revue : cotation_ngap

50 exemples à relire. Pour chaque exemple :
- [ ] La question est réaliste (une IDEL pourrait dire ça)
- [ ] La réponse est correcte (cotation, contenu, etc.)
- [ ] Le ton est approprié (concis, professionnel)

---

## Exemple 1

**System** : _(prompt standard)_

**IDEL** : Caroline : Il faut coter un pansement simple pour M. Garcia. Je l'ai fait ce dimanche à 15h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"description_acte": "pansement simple", "patient": "M. Garcia", "date_soin": "2024-08-04", "heure_soin": "15:45", "jour_ferie": false, "bsi_actif": false, "kilometrage": null}
```

**Résultat outil** :
```json
{"cotation_proposee": [{"code_ngap": "AMI 2", "libelle": "Pansement simple", "tarif_unitaire": 18.2, "quantite": 1, "cumul_article_11": "100%"}, {"code_ngap": "MCI", "libelle": "Majoration Dimanche/Jours Fériés", "tarif_unitaire": 9.15, "quantite": 1, "cumul_article_11": "100%"}], "total_facturation": 27.35, "details_calcul": "AMI 2 (18.20€) + MCI (9.15€) car soin un dimanche."}
```

**Agent** : Pour M. Garcia, ce pansement simple est coté AMI 2 + MCI, soit 27,35€. C'est correct pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 2

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. David, j'ai fait sa perfusion intraveineuse ce dimanche à 18h30. Il habite à 5km en plaine, depuis mon domicile.

**Agent** → appel outil `analyser_et_coter` :
```json
{"actes": ["AMI 4"], "patient_bsi_actif": false, "date_soin": "2025-04-27", "heure_soin": "18:30", "kilometrage": 5, "type_zone_ik": "plaine", "nombre_actes_suppl": 0}
```

**Résultat outil** :
```json
{"total_facture": 48.65, "details_cotation": [{"code": "AMI 4", "tarif_unitaire": 36.4, "quantite": 1, "motif": "Pose et surveillance perfusion IV", "total_acte": 36.4}, {"code": "MCI", "tarif_unitaire": 9.15, "quantite": 1, "motif": "Majoration de coordination infirmière (dimanche/jour férié)", "total_acte": 9.15}, {"code": "IK", "tarif_unitaire": 0.62, "quantite": 5, "motif": "Indemnités kilométriques (5km en plaine)", "total_acte": 3.1}], "cumul_applique": false, "informations_complementaires": []}
```

**Agent** : Pour la perfusion IV de M. David ce dimanche à 18h30 avec 5km :
AMI 4 (36,40€) + MCI (9,15€) + IK (3,10€).
Total facturé : 48,65€.
Est-ce que je peux enregistrer cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 3

**System** : _(prompt standard)_

**IDEL** : J'ai fait le soin de stomie pour M. Garcia ce matin à 9h00. C'était un changement complet de la plaque et de la poche, avec nettoyage minutieux de la peau péristomiale qui était un peu irritée. J'ai aussi refait un point d'éducation avec lui.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Garcia", "type_soin": "Changement complet de matériel de stomie avec nettoyage et éducation patient", "heure_debut": "09:00", "date_soin": "2024-09-16", "patient_bsi_actif": false, "distance_km_plaine": 0, "distance_km_montagne": 0, "actes_supplementaires": []}
```

**Résultat outil** :
```json
{"cotation_ngap": ["AMI 3"], "tarifs_details": {"AMI 3": 27.3, "majoration_nuit_soir": 0.0, "majoration_dimanche_jf": 0.0, "indemnites_kilometriques": 0.0, "total_cumul_article_11": 27.3}, "total_facturable": 27.3, "explication_cotation": "Le soin de stomie complexe (changement de matériel et éducation) est coté AMI 3. Aucune majoration de nuit (MAU, MAD) ou de dimanche/jour férié (MCI) n'est applicable pour un soin à 9h00 un lundi. Pas d'indemnités kilométriques renseignées."}
```

**Agent** : Pour le soin de stomie de M. Garcia à 9h00, la cotation proposée est AMI 3, soit 27,30 €. Pas de majoration applicable. C'est bien cela pour la facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 4

**System** : _(prompt standard)_

**IDEL** : Bonjour ! J'ai fait un pansement complexe pour M. Michel cet après-midi, vers 14h. Son domicile est à 10 km et c'est un trajet en montagne. Peux-tu me donner la cotation ?

**Agent** → appel outil `analyser_et_coter` :
```json
{"acte_principal": "AMI 2", "patient_bsi_actif": false, "heure_soin": "14:00", "jour_soin": "2026-09-22", "nb_kilometres": 10, "zone_geographique": "montagne", "actes_associes": []}
```

**Résultat outil** :
```json
{"cotation_proposee": {"acte_principal": "AMI 2", "tarif_acte_principal": 18.2, "majoration_nuit_dimanche": null, "tarif_majoration": 0.0, "indemnites_kilometriques": {"type": "montagne", "distance_km": 10, "tarif_unitaire": 0.8, "total_ik": 8.0}, "total_a_facturer": 26.2, "details_cotation": [{"element": "Pansement complexe (AMI 2)", "montant": 18.2}, {"element": "Indemnités kilométriques (10km en montagne)", "montant": 8.0}]}, "message": "Cotation calculée avec succès."}
```

**Agent** : Pour M. Michel, la cotation serait AMI 2 + 10km montagne (IK). Soit un total de 26,20€. Je peux enregistrer cette facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 5

**System** : _(prompt standard)_

**IDEL** : Bonjour, j'ai fait une injection intramusculaire simple à Mme Roux ce midi, vers 12h. J'ai parcouru 15 km aller-retour, c'est en plaine.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "Mme Roux", "actes": [], "date": "2025-10-24", "heure_soin": "12:00", "distance_km": 15, "zone_geographique": "plaine", "is_bsi_actif": false, "is_dimanche_ferie": false}
```

**Résultat outil** :
```json
{"cotation_details": [{"acte": "AMI 1", "montant": 9.1, "quantite": 1, "majoration": []}], "indemnites_deplacement": {"type": "IK", "montant": 9.3, "details": {"km": 15, "tarif_km": 0.62, "zone": "plaine"}}, "total_a_facturer": 18.4}
```

**Agent** : Pour l'injection à Mme Roux, la cotation est AMI 1 (9,10€) avec 15 km d'IK (9,30€). Total : 18,40€. Je peux enregistrer cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 6

**System** : _(prompt standard)_

**IDEL** : J'ai fait la prise de sang à Mme Fournier ce matin à 10h15. Il faut que je la cote.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "Mme Fournier", "acts": [{"type": "prise_de_sang", "quantity": 1}], "date": "2024-05-18", "time": "10:15", "patient_bsi_actif": false, "is_sunday_or_holiday": false, "distance_km": 0, "zone": "plaine"}
```

**Résultat outil** :
```json
{"acts_details": [{"code_ngap": "AMI 1", "coefficient": 1, "price_unit": 9.1, "price_total": 9.1, "description": "Prélèvement de sang veineux"}], "majorations": [], "total_ht": 9.1, "total_ttc": 9.1, "cumul_article_11_applied": false, "ik_details": null, "cotation_textuelle": "AMI 1"}
```

**Agent** : Pour la prise de sang de Mme Fournier à 10h15, la cotation proposée est AMI 1, soit 9,10 €. Est-ce correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 7

**System** : _(prompt standard)_

**IDEL** : J'ai fait l'injection de vitamine B12 à M. Robert dimanche dernier, le 6 septembre, à 20h15. Il n'a pas de BSI.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Robert", "date_soin": "2026-09-06", "heure_soin": "20:15", "actes": [], "distance_km": 0, "patient_bsi_actif": false}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"code_ngap": "AMI 1", "libelle": "Injection IM/SC", "tarif_unitaire": 9.1, "quantite": 1, "tarif_total": 9.1, "cumul_applique": "100%"}, {"code_ngap": "IFD", "libelle": "Indemnité forfaitaire de déplacement", "tarif_unitaire": 2.5, "quantite": 1, "tarif_total": 2.5, "cumul_applique": "100%"}, {"code_ngap": "MCI", "libelle": "Majoration dimanche/jour férié", "tarif_unitaire": 9.15, "quantite": 1, "tarif_total": 9.15, "cumul_applique": "100%"}], "total_facture": 20.75, "details_calcul": "Soin AMI 1 (9.10€) + Indemnité Forfaitaire de Déplacement (2.50€) + Majoration Dimanche (MCI) (9.15€). La majoration de nuit (MAU) n'est pas cumulable avec la majoration dimanche (MCI), et MCI est prioritaire."}
```

**Agent** : La cotation pour l'injection de M. Robert le dimanche 6 septembre à 20h15 est : AMI 1 + IFD + MCI, soit un total de 20,75€. La majoration MAU n'est pas appliquée car MCI est prioritaire. Confirmez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 8

**System** : _(prompt standard)_

**IDEL** : J'ai fait le pansement simple de M. Garcia ce matin à 7h15.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Garcia", "actes": [], "heure_soin": "07:15", "date_soin": "2026-07-23", "est_dimanche_ferie": false, "patient_bsi_actif": false, "kilometrage_plaine": 0, "kilometrage_montagne": 0}
```

**Résultat outil** :
```json
{"codes_ngap": ["AMI 2", "MAU"], "montant_total": 27.35, "details_calcul": [{"libelle": "AMI 2 (pansement simple)", "code": "AMI 2", "montant": 18.2, "unite": "€", "quantite": 1}, {"libelle": "Majoration acte unique (5h-8h / 20h-23h)", "code": "MAU", "montant": 9.15, "unite": "€", "quantite": 1}], "message_info": "La cotation inclut la majoration MAU pour l'heure du soin."}
```

**Agent** : Pour le pansement de M. Garcia à 7h15, la cotation est AMI 2 + MAU, soit un total de 27,35€. Est-ce correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 9

**System** : _(prompt standard)_

**IDEL** : Ce matin à 8h, j'ai fait une injection de Lovenox à Mme Bertrand. Elle a un BSI actif à cause de ses multiples plaies chroniques.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient": "Mme Bertrand", "date": "2024-02-07", "heure_debut": "08:00", "soins": [{"libelle": "Injection sous-cutanée (Lovenox)", "code_ngap_propose": "AMI 1", "quantite": 1}], "patient_bsi_actif": true}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"code_acte": "AMX 1", "libelle": "Injection sous-cutanée (BSI actif)", "quantite": 1, "tarif_unitaire": 9.1, "total_acte": 9.1}], "majorations": [{"code_majoration": "MAU", "libelle": "Majoration acte unique / nuit (5h-8h)", "montant": 9.15}], "cumul_article_11": [], "indemnites_kilometriques": [], "total_facturation": 18.25, "details_calcul": "AMX 1 (9.10€) + Majoration MAU (9.15€) = 18.25€"}
```

**Agent** : Pour l'injection de Mme Bertrand à 8h avec BSI actif : AMX 1 (9,10€) + MAU (9,15€), soit un total de 18,25€. Confirmez-vous cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 10

**System** : _(prompt standard)_

**IDEL** : J'ai fait les soins de stomie de M. David à 15h15.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. David", "actes": ["AMI 3"], "heure_soin": "15:15", "date_soin": "2026-01-25", "bsi_actif": false, "majou_dimanche_ferie": true}
```

**Résultat outil** :
```json
{"details_actes": [{"acte": "AMI 3", "tarif_unitaire": 27.3, "quantite": 1, "cumul_coef": 100, "total_acte": 27.3}], "majorations": [{"type": "MCI", "montant": 9.15}], "indemnites_kilometriques": [], "total_facture": 36.45}
```

**Agent** : Pour le soin de stomie de M. David à 15h15, la cotation est AMI 3 + MCI (dimanche), soit 36,45€. Je peux enregistrer ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 11

**System** : _(prompt standard)_

**IDEL** : J'ai fait un pansement simple à Mme Petit tout à l'heure, vers 18h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"actes": [], "patient": "Mme Petit", "heure_soin": "18:45", "date_soin": "2026-09-10", "patient_bsi_actif": false, "distance_ik_km": 0, "terrain_montagne": false}
```

**Résultat outil** :
```json
{"cotation_proposee": "AMI 2", "tarif_total": 18.2, "details": "AMI 2 (18,20€)"}
```

**Agent** : Pour le pansement simple de Mme Petit à 18h45, la cotation est AMI 2 (18,20€).
Est-ce correct pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 12

**System** : _(prompt standard)_

**IDEL** : J'ai dû faire une injection sous-cutanée pour Mme Petit ce matin, à 6h. C'était un peu sport pour y aller, j'ai fait 15km aller-retour en zone de montagne.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Petit", "actes": ["AMI 1"], "heure_soin": "06:00", "date_soin": "2024-11-09", "distance_km": 15, "type_trajet": "montagne", "bsi_actif": false, "cumulative_acts": false}
```

**Résultat outil** :
```json
{"cotation": "AMI 1 + MAU + IK", "montant_total": 30.25, "details": {"AMI 1": 9.1, "MAU": 9.15, "IK": 12.0, "description_IK": "15 km en zone montagne (0,80€/km)"}, "erreur": null}
```

**Agent** : Pour l'injection SC de Mme Petit à 6h en montagne : AMI 1 + MAU + IK, soit un total de 30,25€. Confirmez-vous cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 13

**System** : _(prompt standard)_

**IDEL** : J'ai posé la perfusion sous-cutanée de M. Laurent ce matin à 10h30. Quelle est la cotation s'il te plaît ?

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Laurent", "date_soin": "2024-06-20", "heure_soin": "10:30", "actes": ["AMI 3"]}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"acte": "AMI 3", "tarif_unitaire": 27.3, "quantite": 1, "cumul_coefficient": 1.0, "majoration_type": "aucune", "majoration_tarif": 0.0, "sous_total": 27.3}], "total_actes": 27.3, "total_deplacement": 0.0, "total_generale": 27.3, "messages_information": ["Actes cotés à 100% selon l'article 11 de la NGAP."]}
```

**Agent** : Pour la pose de perfusion sous-cutanée de M. Laurent à 10h30, la cotation est AMI 3, soit 27,30€. C'est bien cela pour la facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 14

**System** : _(prompt standard)_

**IDEL** : J'ai fait un prélèvement sanguin pour Mme Roux. C'était hier soir à 20h, un dimanche.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Roux", "date_soin": "2026-11-29", "heure_soin": "20:00", "actes": ["AMI 1"], "est_dimanche_ou_jour_ferie": true, "majoration_mau": false, "majoration_mci": true, "majoration_mad": false, "patient_bsi_actif": false, "kilometrage_plaine": 0, "kilometrage_montagne": 0}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"code": "AMI 1", "quantite": 1, "taux": 9.1, "montant": 9.1, "cumul_coeff": 1.0}], "majorations": [{"type": "MCI", "montant": 9.15, "motif": "Soins le dimanche ou jour férié"}], "indemnites_kilometriques": [], "total_facture": 18.25, "codes_ngap_proposes": ["AMI 1"], "codes_ngap_selectionnes": ["AMI 1"], "message_supplementaire": "La majoration MCI a été appliquée car le soin a eu lieu un dimanche. La MAU n'est pas cumulable avec la MCI."}
```

**Agent** : Pour Mme Roux, le prélèvement du dimanche à 20h est coté AMI 1 + MCI, soit 18,25€. C'est correct pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 15

**System** : _(prompt standard)_

**IDEL** : J'ai fait la toilette complète de M. David ce matin à 9h45. Il est vraiment très dépendant.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. David", "actes": ["AIS 3"], "heure_soin": "09:45", "date_soin": "2024-12-09", "patient_bsi_actif": false}
```

**Résultat outil** :
```json
{"cotation": "AIS 3", "total_facturable": 27.3, "details": [{"code": "AIS 3", "quantite": 1, "tarif_unitaire": 27.3, "total": 27.3}], "majorations": []}
```

**Agent** : Pour la toilette complète de M. David ce matin à 09h45 :
AIS 3 : 27,30 €.

Confirmez-vous cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 16

**System** : _(prompt standard)_

**IDEL** : J'ai fait un pansement simple pour Mme Bertrand, puis une injection sous-cutanée, les deux à 17h30.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Bertrand", "date_soin": "2025-02-19", "heure_soin": "17:30", "actes": [], "est_dimanche_ou_ferie": false, "est_nuit_mau": false, "est_nuit_mad": false, "patient_bsi_actif": false, "kilometrage_aller_retour": 0}
```

**Résultat outil** :
```json
{"cotation_details": [{"acte": "Pansement simple/ablation fils ou agrafes", "code_ngap": "AMI 2", "tarif_unitaire": 18.2, "coefficient_cumul": 100, "tarif_applique": 18.2}, {"acte": "Injection sous-cutanée", "code_ngap": "AMI 1", "tarif_unitaire": 9.1, "coefficient_cumul": 50, "tarif_applique": 4.55}], "majorations": [], "indemnites_kilometriques": {"montant": 0.0, "details": "Pas d'IK demandées."}, "total_facture": 22.75, "message": "Cotation calculée avec cumul d'actes (100% + 50%)."}
```

**Agent** : Pour Mme Bertrand le 19/02 à 17h30, la cotation serait :
AMI 2 (100%) pour le pansement, soit 18,20€
AMI 1 (50%) pour l'injection, soit 4,55€
Total : 22,75€.
C'est correct pour l'ajout à la facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 17

**System** : _(prompt standard)_

**IDEL** : J'ai refait le pansement de M. Fontaine ce matin à 10h30. C'était un pansement simple.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "M. Fontaine", "care_description": "Refait le pansement simple", "care_date": "2026-11-05", "care_time": "10:30", "acts": [{"type": "Pansement", "details": "simple", "ngap_code_base": "AMI 2", "quantite": 1}], "patient_bsi_actif": false, "majoration_dimanche_ferie": false, "majoration_nuit": false, "distance_km": 0, "zone_montagne": false}
```

**Résultat outil** :
```json
{"cotation_detail": {"acts": [{"code": "AMI 2", "description": "Pansement simple", "base_price": 18.2, "coefficient": 1, "total_act_price": 18.2, "majoration": []}], "majorations_total": 0.0, "ik_total": 0.0, "total_facturation": 18.2, "explanation": "Cotation pour un pansement simple (AMI 2)."}}
```

**Agent** : Pour M. Fontaine, le pansement simple est côté AMI 2, soit 18,20€.
Je valide cette cotation pour l'enregistrement ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 18

**System** : _(prompt standard)_

**IDEL** : Salut Nath, pour M. Garcia, j'ai fait le contrôle habituel de sa sonde urinaire cette après-midi, vers 17h45. Son BSI est toujours actif. Tu peux coter ça ?

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "M. Garcia", "acts": [{"code": "AMX 2", "quantity": 1}], "care_date": "2025-12-20", "care_time": "17:45", "is_bsi_actif": true, "distance_km_plain": 0, "is_sunday_or_holiday": false, "is_night_20h_23h_or_5h_8h": false, "is_night_23h_5h": false}
```

**Résultat outil** :
```json
{"patient_name": "M. Garcia", "total_amount": 18.2, "details": [{"code": "AMX 2", "unit_price": 18.2, "quantity": 1, "subtotal": 18.2, "is_bsi_related": true, "majoration": null}], "majorations_applied": [], "ik_details": null, "cumul_applied": false, "warnings": []}
```

**Agent** : Pour la surveillance de sonde urinaire de M. Garcia (BSI actif) le 20/12 à 17h45, la cotation est AMX 2. Total : 18,20€. Je valide cette facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 19

**System** : _(prompt standard)_

**IDEL** : J'ai fait un pansement simple sur la cicatrice de Mme Simon ce matin à 8h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient": "Mme Simon", "soins": [{"code": "AIS", "coeff": 1, "description": "Pansement post-opératoire simple"}], "date": "2024-07-13", "heure_debut": "08:45", "type_jour": "samedi", "patient_bsi_actif": false, "km_plaine": 0, "km_montagne": 0}
```

**Résultat outil** :
```json
{"cotation_totale": 3.15, "details": [{"acte": "AMI 2", "tarif": 3.15, "cumul": "100%"}], "majorations": [], "ik": null}
```

**Agent** : Pour le pansement simple de Mme Simon à 8h45, je propose la cotation AMI 2 (3,15 €).
Pas de majoration car le soin a eu lieu en journée hors dimanche/jour férié.
Est-ce correct, Céline ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 20

**System** : _(prompt standard)_

**IDEL** : J'ai surveillé la sonde urinaire de Mme Thomas, pas de souci particulier. C'était à 17h30.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient": "Mme Thomas", "soin_description": "surveillance de sonde urinaire", "heure_soin": "17:30", "date_soin": "2025-02-28", "patient_bsi_actif": false, "distance_km": 0, "actes_additionnels": []}
```

**Résultat outil** :
```json
{"cotation": [{"code": "AMI 1", "quantite": 1, "tarif_unitaire": 9.1, "total": 9.1}], "majorations": [], "indemnites_kilometriques": null, "cumul_article_11_applique": false, "total_facturation": 9.1}
```

**Agent** : Pour la surveillance de sonde urinaire de Mme Thomas, la cotation proposée est :
- AMI 1 : 9,10€
Total : 9,10€.
C'est exact ? Puis-je enregistrer ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 21

**System** : _(prompt standard)_

**IDEL** : Bonjour, ce matin à 9h30, chez M. Michel, j'ai géré et aidé à la prise de ses traitements habituels, et j'ai aussi dû faire une surveillance de son état général qui semblait un peu dégradé. Il était faible, j'ai vérifié ses constantes pendant une bonne demi-heure.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient": "M. Michel", "actes": ["AMI 1", "AMI 3"], "date": "2024-07-10", "heure": "09:30", "majoration_dimanche_jf": false, "majoration_nuit_20h_23h_5h_8h": false, "majoration_nuit_23h_5h": false, "patient_bsi_actif": false, "kilometrage": 5, "type_terrain_ik": "plaine"}
```

**Résultat outil** :
```json
{"cotation_details": [{"acte": "AMI 1", "quantite": 1, "tarif_unitaire": 9.1, "taux_cumul": 100, "sous_total": 9.1}, {"acte": "AMI 3", "quantite": 1, "tarif_unitaire": 27.3, "taux_cumul": 50, "sous_total": 13.65}], "majorations": [], "indemnites_kilometriques": {"distance_km": 5, "tarif_km": 0.62, "montant_ik": 3.1}, "montant_total": 25.85, "notes": "Calcul basé sur les règles NGAP en vigueur, incluant la règle de cumul article 11."}
```

**Agent** : Pour M. Michel, la cotation inclut :
- AMI 1 (9,10€) pour les médicaments
- AMI 3 à 50% (13,65€) pour la surveillance
- IK 5km plaine (3,10€)
Total de 25,85€. Confirmez-vous l'enregistrement ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 22

**System** : _(prompt standard)_

**IDEL** : J'ai fait le pansement de M. Fontaine ce matin à 7h15. C'était un pansement assez lourd, une escarre sacrée stade 3 avec un débridement enzymatique à refaire. J'ai bien nettoyé et posé un hydrocellulaire.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient": "M. Fontaine", "type_acte": "pansement_lourd_et_complexe", "heure_soin": "07:15", "date_soin": "2024-06-22", "present_bsi": false, "kilometres_plaine": 0, "kilometres_montagne": 0, "autres_actes_cumul": []}
```

**Résultat outil** :
```json
{"total_facturable": 45.55, "details": [{"id_acte": "acte_001", "libelle": "Pansement lourd et complexe (escarre stade 3 avec débridement enzymatique)", "cotation": "AMI 4", "montant_base": 36.4, "majorations": [{"type": "MAU", "montant": 9.15, "motif": "soin_matinal_entre_5h_et_8h"}]}], "remarques": []}
```

**Agent** : Pour le pansement de M. Fontaine à 07h15 : 
C'est un AMI 4 (36,40€) avec la majoration MAU (9,15€) pour le soin matinal. 
Le total est de 45,55€. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 23

**System** : _(prompt standard)_

**IDEL** : Salut ! Ce matin, je suis passée chez M. David. C'était pour son pansement d'ulcère de jambe habituel, le soin a été fait vers 6h45. J'ai eu environ 15km aller-retour à faire en plaine.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "M. David", "date_of_care": "2025-10-02", "time_of_care": "06:45", "is_sunday_or_holiday": false, "acts": [{"code": "AMI 2", "description": "Pansement d'ulcère de jambe"}], "travel_distance_km_aller_retour": 15, "is_mountain": false, "is_bsi_active": false}
```

**Résultat outil** :
```json
{"total_amount": 36.65, "details": [{"code": "AMI 2", "description": "Pansement d'ulcère de jambe", "base_price": 18.2, "quantity": 1, "cumulative_coefficient": 1.0, "price": 18.2}, {"code": "MAU", "description": "Majoration d'acte unique (5h-8h)", "price": 9.15}, {"code": "IK", "description": "Indemnités kilométriques (15km plaine)", "price": 9.3}]}
```

**Agent** : J'ai calculé la cotation pour M. David : un AMI 2 avec la majoration MAU et les IK. Total : 36,65€. Confirmez-vous la facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 24

**System** : _(prompt standard)_

**IDEL** : J'ai fait l'injection de Lovenox à M. Dupont ce matin à 7h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"actes": ["injection sous-cutanée"], "patient": "M. Dupont", "heure_soin": "07:45", "date_soin": "2025-02-11", "presence_bsi": false}
```

**Résultat outil** :
```json
{"cotation": {"actes": [{"code": "AMI 1", "tarif_unitaire": 9.1, "coefficient_cumul": 1.0, "description": "Injection sous-cutanée"}], "majorations": [{"code": "MAU", "tarif": 9.15, "motif": "Soins entre 5h et 8h"}], "indemnites_kilometriques": null, "total_facturation": 18.25}, "message": "Cotation calculée avec succès."}
```

**Agent** : Pour l'injection de M. Dupont à 7h45, la cotation est AMI 1 + MAU. Total : 18,25 €. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 25

**System** : _(prompt standard)_

**IDEL** : Ce matin, j'ai vu M. Fontaine au cabinet. Je lui ai refait son pansement d'ulcère, c'était un pansement assez lourd avec nettoyage et tout. Après, je lui ai fait son injection d'insuline après avoir vérifié sa glycémie. Et avant qu'il parte, j'ai pris sa tension et discuté un peu de son régime.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "M. Fontaine", "heure_soin": "11:00", "date_soin": "2024-12-20", "lieu_soin": "cabinet", "actes": [], "kilometrage": null, "is_bsi_active": false}
```

**Résultat outil** :
```json
{"cotation_details": [{"acte": "Pansement lourd et complexe ulcère", "code_ngap": "AMI 4", "tarif_unitaire": 36.4, "coefficient_cumul": 1.0, "tarif_final": 36.4}, {"acte": "Glycémie capillaire et injection insuline SC", "code_ngap": "AMI 2", "tarif_unitaire": 18.2, "coefficient_cumul": 0.5, "tarif_final": 9.1}, {"acte": "Surveillance constantes et conseils régime", "code_ngap": "AMI 1", "tarif_unitaire": 9.1, "coefficient_cumul": 0.0, "tarif_final": 0.0}], "majorations": [], "indemnites_deplacement": [], "total_facture": 45.5, "messages_information": ["Les actes sont soumis à la règle de cumul de l'article 11. Le 3ème acte n'est pas facturable."]}
```

**Agent** : Pour M. Fontaine au cabinet à 11h, la cotation est : AMI 4 (36,40€), AMI 2 (9,10€ à 50%), et AMI 1 non facturable. Total : 45,50€. C'est bien ça ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 26

**System** : _(prompt standard)_

**IDEL** : Bonjour, pour Mme Roux, j'ai refait un pansement complexe à sa jambe, surveillé sa perfusion intraveineuse qui passait lentement, et j'ai fait sa glycémie capillaire avant le coucher. C'était vers 21h.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Roux", "date_soin": "2024-04-08", "heure_soin": "21:00", "actes": [], "patient_bsi_actif": false, "distance_km_plaine": null, "distance_km_montagne": null}
```

**Résultat outil** :
```json
{"cotation_details": [{"acte": "AMI 4", "description": "Refection pansement complexe", "tarif_unitaire": 36.4, "coefficient_cumul": 1.0, "tarif_applique": 36.4}, {"acte": "AMI 3", "description": "Surveillance perfusion IV", "tarif_unitaire": 27.3, "coefficient_cumul": 0.5, "tarif_applique": 13.65}, {"acte": "AMI 1", "description": "Glycémie capillaire", "tarif_unitaire": 9.1, "coefficient_cumul": 0.0, "tarif_applique": 0.0}], "majorations": [{"type": "MAU", "tarif": 9.15, "motif": "Soins effectués entre 20h et 23h"}], "ik_details": [], "total_facturable": 59.2, "regles_appliquees": ["Cumul Article 11", "Majoration de nuit (MAU)"], "patient_nom": "Mme Roux"}
```

**Agent** : Pour Mme Roux, la cotation est : AMI 4 (100%), AMI 3 (50%), AMI 1 (0%) + MAU, soit 59,20 € au total. Est-ce correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 27

**System** : _(prompt standard)_

**IDEL** : J'ai fait la toilette complète de Mme Fournier ce soir à 20h30. Elle est totalement dépendante.

**Agent** → appel outil `analyser_et_coter` :
```json
{"acte_principal_description": "Toilette complète", "patient_nom": "Mme Fournier", "date_soin": "2025-02-07", "heure_soin": "20:30", "patient_bsi_actif": false, "actes_associes": [], "kilometrage_plaine": 0, "kilometrage_montagne": 0}
```

**Résultat outil** :
```json
{"cotation_details": [{"code_ngap": "AIS 3", "libelle": "Toilette complète, patient dépendant", "coefficient": 3, "unite_tarifaire": "AIS", "tarif_unitaire": 9.1, "tarif_base": 27.3, "cumul_coefficient": 1.0, "tarif_cumul_applique": 27.3}], "majorations": [{"code_majoration": "MAU", "libelle": "Majoration d'acte unique de nuit (20h-23h ou 5h-8h)", "tarif": 9.15}], "indemnites_kilometriques": {"distance_plaine_km": 0, "distance_montagne_km": 0, "tarif_ik": 0, "montant_ik": 0}, "total_ht": 36.45, "messages_info": []}
```

**Agent** : Pour la toilette de Mme Fournier, la cotation est : 
AIS 3 (27,30€) + MAU (9,15€) = 36,45€. 
Je peux l'ajouter à sa facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 28

**System** : _(prompt standard)_

**IDEL** : Céline ici. Pour M. Fontaine, j'ai fait un pansement complexe à midi quarante-cinq. Le trajet était long en montagne, environ 10 km.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Fontaine", "date_soin": "2026-03-22", "heure_soin": "12:45", "actes": ["AMI"], "distance_km": 10, "type_trajet": "montagne", "bsi_actif": false}
```

**Résultat outil** :
```json
{"cotation_details": [{"code_ngap": "AMI 2", "description": "Pansement complexe", "tarif_unitaire": 18.2, "quantite": 1, "total": 18.2, "taux_cumul": "100%"}, {"code_ngap": "MCI", "description": "Majoration Dimanche/Jour Férié", "tarif_unitaire": 9.15, "quantite": 1, "total": 9.15}, {"code_ngap": "IK", "description": "Indemnité Kilométrique (montagne)", "tarif_unitaire_km": 0.8, "distance_km": 10, "total": 8.0}], "total_facturation": 35.35, "informations_complementaires": "Le soin a été effectué un dimanche, d'où l'application de la majoration MCI. Le trajet en zone de montagne justifie l'application du tarif IK majoré à 0,80€/km."}
```

**Agent** : Pour M. Fontaine, le pansement complexe (AMI 2), avec la majoration dimanche (MCI) et les 10 km montagne (IK), totalise 35,35€. C'est bien cela ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 29

**System** : _(prompt standard)_

**IDEL** : J'ai fait la surveillance de la sonde urinaire chez Mme Martin cet après-midi, vers 17h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Martin", "actes": ["AMI 2"], "heure_soin": "17:45", "date_soin": "2025-06-20", "patient_bsi_actif": false, "majoration_nuit_dimanche": []}
```

**Résultat outil** :
```json
{"details_actes": [{"code": "AMI 2", "description": "Surveillance de sonde urinaire", "tarif_unitaire": 18.2, "quantite": 1, "montant_total": 18.2, "taux_remboursement": "100%"}], "majorations": [], "forfaits": [], "indemnites_kilometriques": null, "total_patient": 18.2, "total_ngap": 18.2, "message": "Cotation calculée avec succès."}
```

**Agent** : Pour la surveillance de sonde urinaire de Mme Martin, la cotation est AMI 2, soit 18,20€. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 30

**System** : _(prompt standard)_

**IDEL** : Bonjour, j'ai fait le pansement de l'escarre de Mme Girard au sacrum tout à l'heure, vers 15h15. C'est une stade 2, je l'ai bien nettoyée et j'ai refait le pansement avec un hydrocolloïde. Je dois coter ça comment ?

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient": "Mme Girard", "description_acte": "pansement escarre stade 2 au sacrum avec hydrocolloïde", "heure_acte": "15:15", "type_acte": "pansement"}
```

**Résultat outil** :
```json
{"cotation_proposee": [{"acte": "AMI 4", "quantite": 1, "tarif_unitaire": 36.4, "motif": "Pansement d'escarre stade 2"}], "majorations": [], "montant_total": 36.4, "details_calcul": "1x AMI 4 (36,40€)", "commentaires": "La cotation AMI 4 est spécifique aux pansements d'escarres, brûlures ou ulcères étendus ou multiples. Pour une escarre stade 2, il n'y a pas de cotation AIS."}
```

**Agent** : Pour Mme Girard, le pansement d'escarre stade 2 au sacrum est à coter AMI 4, soit 36,40€. Pas de majoration car soin à 15h15. C'est bien ça ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 31

**System** : _(prompt standard)_

**IDEL** : Caroline : Bonjour ! Ce matin chez M. David, j'ai dû refaire un pansement vraiment lourd et complexe, une grosse plaie à soigner. J'ai commencé le soin vers 7h50 et je suis partie à 8h15. Il n'est pas sous BSI, pas de route particulière non plus.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. David", "actes": ["AMI 4"], "bsi_actif": false, "kilometrage": null}
```

**Résultat outil** :
```json
{"cotation_details": [{"code": "AMI 4", "libelle": "Pansement lourd et complexe", "tarif_unitaire": 36.4, "quantite": 1, "tarif_total": 36.4, "type": "acte_ngap"}, {"code": "MAU", "libelle": "Majoration de nuit (5h-8h)", "tarif_unitaire": 9.15, "quantite": 1, "tarif_total": 9.15, "type": "majoration"}], "total_facturable": 45.55, "codes_retenus": ["AMI 4", "MAU"], "remarques": "Pansement lourd et complexe (AMI 4) avec majoration de nuit (MAU) car le soin a débuté entre 5h et 8h."}
```

**Agent** : Pour le pansement lourd et complexe de M. David, la cotation est AMI 4 + MAU, soit 45,55 €. Est-ce bien cela ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 32

**System** : _(prompt standard)_

**IDEL** : J'ai fait un pansement simple pour M. Fontaine ce matin à 10h15, le 27 août. C'est juste un soin de cicatrice propre, rien de compliqué.

**Agent** → appel outil `analyser_et_coter` :
```json
{"description_acte": "Pansement simple de cicatrice propre", "patient": "M. Fontaine", "date": "2026-08-27", "heure": "10:15", "actes_associes": [], "presente_bsi_actif": false, "distance_km": null, "type_deplacement": null}
```

**Résultat outil** :
```json
{"actes_cotes": [{"code_ngap": "AMI 2", "libelle": "Pansement simple", "tarif_unitaire": 18.2, "coefficient_cumul": 1.0, "tarif_applique": 18.2}], "majorations": [], "indemnites_deplacement": null, "total_a_facturer": 18.2, "details_cotation": "Pansement simple (AMI 2) à 18,20€. Aucune majoration ou indemnité de déplacement applicable pour cet acte."}
```

**Agent** : Pour le pansement simple de M. Fontaine ce matin, je propose une cotation AMI 2, soit 18,20€. Pas de majoration à cette heure. Confirmez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 33

**System** : _(prompt standard)_

**IDEL** : J'ai fait le pansement d'une plaie simple chez Mme Fournier ce matin, à 8h pile.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "Mme Fournier", "acts": [{"description": "pansement simple", "code_ngap": "AMI2"}], "heure_acte": "08:00", "date_acte": "2026-04-11", "bsi_actif": false, "cumul_article_11": null, "kilometrage_plaine": null, "kilometrage_montagne": null}
```

**Résultat outil** :
```json
{"total_amount": 27.35, "details": [{"code": "AMI2", "amount": 18.2, "description": "Pansement simple"}, {"code": "MAU", "amount": 9.15, "description": "Majoration pour acte de nuit (5h-8h ou 20h-23h)"}], "message": "Cotation calculée avec succès."}
```

**Agent** : Pour Mme Fournier, le pansement à 8h est coté AMI 2 + MAU, soit 27,35 €. Confirmez-vous cette facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 34

**System** : _(prompt standard)_

**IDEL** : J'ai fait trois choses chez Mme Roux à 16h : un pansement simple, une injection sous-cutanée et j'ai vérifié sa tension.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Roux", "date_soin": "2024-12-13", "heure_soin": "16:00", "actes": []}
```

**Résultat outil** :
```json
{"cotation_proposee": {"total": 22.75, "detail": {"AMI 2": {"quantite": 1, "prix_unitaire": 18.2, "taux_cumul": 100, "montant_facture": 18.2, "libelle": "Pansement simple"}, "AMI 1 (injection)": {"quantite": 1, "prix_unitaire": 9.1, "taux_cumul": 50, "montant_facture": 4.55, "libelle": "Injection sous-cutanée"}, "AMI 1 (tension)": {"quantite": 1, "prix_unitaire": 9.1, "taux_cumul": 0, "montant_facture": 0.0, "libelle": "Surveillance tension"}}}, "majorations": [], "kilometres": null, "message": "Cotation appliquée selon l'article 11."}
```

**Agent** : Pour Mme Roux, la cotation proposée est de 22,75€ :
- AMI 2 (pansement) à 100% : 18,20€
- AMI 1 (injection) à 50% : 4,55€
- AMI 1 (tension) à 0% : 0,00€

Souhaitez-vous valider cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 35

**System** : _(prompt standard)_

**IDEL** : J'ai vérifié la sonde urinaire de Mme Martin à 12h30, vidange du sac et surveillance de la diurèse, tout est OK.

**Agent** → appel outil `analyser_et_coter` :
```json
{"actes": [], "patient": {"nom": "Mme Martin", "bsi_actif": false}, "contexte": {"date": "2024-01-08", "heure": "12:30", "kilometrage": {"plaine": 0, "montagne": 0}}}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"acte": "Surveillance et vidange de la sonde urinaire", "code_ngap": "AMI 1", "quantite": 1, "unite_tarifaire": 9.1, "total_acte": 9.1, "majoration_article_11": 1.0, "facturable": true}], "majorations": [], "indemnites_kilometriques": {"total_ik": 0.0, "detail": []}, "total_a_facturer": 9.1, "messages_alerte": []}
```

**Agent** : Pour la surveillance de la sonde de Mme Martin à 12h30, la cotation proposée est AMI 1, soit 9,10€. Souhaitez-vous valider cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 36

**System** : _(prompt standard)_

**IDEL** : J'ai fait un prélèvement sanguin pour l'INR de M. Leroy, vers 20h15. C'était le seul soin chez lui aujourd'hui.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Leroy", "date_soin": "2025-09-10", "heure_soin": "20:15", "actes": ["AMI 1"], "bsi_actif": false, "distance_km": null, "nombre_actes_avant": 0}
```

**Résultat outil** :
```json
{"total_facturation": 18.25, "details_actes": [{"code_ngap": "AMI 1", "libelle": "Prélèvement sanguin (INR)", "base_tarif": 9.1, "coeff_cumul": 1.0, "tarif_final": 9.1}], "majorations": [{"type": "MAU", "montant": 9.15, "conditions": "Soins entre 20h et 23h ou 5h et 8h (mercredi 20:15)"}], "ik": null, "cumul_article_11_applique": false, "resume_cotation": "AMI 1 + MAU", "commentaires": "Prélèvement sanguin (INR) pour M. Leroy le 10/09/2025 à 20:15."}
```

**Agent** : La cotation pour le prélèvement INR de M. Leroy est AMI 1 + MAU, soit 18,25 €. Souhaitez-vous que je l'ajoute à son dossier de facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 37

**System** : _(prompt standard)_

**IDEL** : J'ai fait la toilette complète de Mme Simon cet après-midi, elle est très dépendante et n'arrive plus à bouger seule du tout. C'était vers 14h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_id": "Mme Simon", "actes": [], "date_soin": "2026-06-09", "heure_soin": "14:45"}
```

**Résultat outil** :
```json
{"cotation": "AIS 3", "montant": 12.6, "details": [{"acte": "Toilette complète (patient dépendant)", "code": "AIS 3", "quantite": 1, "taux": 100, "prix_unitaire": 12.6, "total": 12.6}], "majorations": [], "kilometres": null, "total_facturable": 12.6}
```

**Agent** : Pour la toilette complète de Mme Simon, la cotation est AIS 3, soit 12,60€. Pas de majoration à cette heure. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 38

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Bertrand, j'ai fait une prise de sang ce samedi à 15h. Peux-tu me donner la cotation s'il te plaît ?

**Agent** → appel outil `analyser_et_coter` :
```json
{"acte": "prélèvement veineux", "patient": "Mme Bertrand", "date": "2026-11-07", "heure": "15:00"}
```

**Résultat outil** :
```json
{"acte_ngap": "AMI 1.5", "description_ngap": "Prélèvement veineux", "coefficient": 1.5, "tarif_unitaire_base": 9.1, "montant_total_calcule": 13.65, "majorations_appliquees": [], "montant_total_avec_majorations": 13.65, "cumul_applique": false, "notes": "Acte isolé. Pas de majoration (heure en journée, jour ouvré)."}
```

**Agent** : Pour le prélèvement veineux de Mme Bertrand ce samedi à 15h, la cotation est AMI 1.5, soit 13,65 €. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 39

**System** : _(prompt standard)_

**IDEL** : J'ai réalisé un pansement simple sur la cicatrice de M. Dupont cet après-midi vers 15h30.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Dupont", "type_acte": "AMI 2", "heure_soin": "15:30", "date_soin": "2025-12-26", "patient_bsi_actif": false, "autres_actes_prevus": [], "distance_km_plaine": 0, "distance_km_montagne": 0}
```

**Résultat outil** :
```json
{"cotation_details": [{"code": "AMI 2", "libelle": "Pansement simple post-opératoire", "unites": 1, "tarif_unitaire": 2.65, "total": 2.65}], "majorations": [], "indemnites_kilometriques": [], "total_facturation": 2.65}
```

**Agent** : La cotation pour le pansement simple de M. Dupont à 15h30 est de 2,65€ (AMI 2). Confirmez-vous la facturation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 40

**System** : _(prompt standard)_

**IDEL** : J'ai réalisé l'évaluation initiale du Bilan de Soins Infirmiers pour M. Blanc cet après-midi, vers 15h30. C'est sa première, il est classé en GIR 2. Le BSI est bien actif.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Blanc", "date_soin": "2026-06-18", "heure_soin": "15:30", "actes": []}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"code_ngap": "BSC", "coeff_ami": null, "quantite": 1, "tarif_unitaire": 27.3, "majoration_mau": false, "majoration_mci": false, "majoration_mad": false, "majoration_nuit_dimanche_jf": false, "cumul_article_11": "100%"}], "montant_total_actes": 27.3, "montant_total_ik": 0.0, "montant_total_final": 27.3, "message": "Cotation calculée avec succès."}
```

**Agent** : Pour l'évaluation initiale BSI (GIR 1-2) de M. Blanc à 15h30, la cotation proposée est un BSC (27,30€). Le total s'élève à 27,30€. Confirmez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 41

**System** : _(prompt standard)_

**IDEL** : J'ai fait une injection de Lovenox à M. Garcia à 16h45 cet après-midi.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Garcia", "description_acte": "injection de Lovenox", "heure_soin": "16:45", "date_soin": "2024-07-14", "is_bsi_actif": false, "nombre_actes_precedents": 0, "distance_km": 0}
```

**Résultat outil** :
```json
{"cotations_detaillees": [{"acte": "AMI 1", "libelle": "Injection sous-cutanée", "tarif_unitaire": 9.1, "quantite": 1, "coefficient_cumul": 1.0, "total_acte": 9.1}, {"acte": "MCI", "libelle": "Majoration Dimanche ou Jour Férié", "tarif_unitaire": 9.15, "quantite": 1, "coefficient_cumul": 1.0, "total_acte": 9.15}], "total_facturation": 18.25, "details_calcul": "Un acte AMI 1 pour l'injection sous-cutanée, avec application de la majoration MCI car le soin a eu lieu un dimanche et jour férié (14 juillet)."}
```

**Agent** : Pour l'injection de Lovenox à M. Garcia (14/07 à 16h45), la cotation est AMI 1 + MCI, soit 18,25 €. Souhaitez-vous valider cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 42

**System** : _(prompt standard)_

**IDEL** : J'ai posé une sonde urinaire à Mme Lefebvre ce matin à 9h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_id": "Mme Lefebvre", "date_soin": "2026-11-19", "heure_soin": "09:45", "actes": ["AMI 3"], "kilometres": 0, "nature_terrain": "plaine"}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"code_ngap": "AMI 3", "description": "Pose de sonde urinaire", "tarif_unitaire": 27.3, "coefficient": 1.0, "facture_apres_cumul": 27.3}], "total_actes": 27.3, "total_majorations": 0.0, "total_indemnites_kilometriques": 0.0, "total_facture": 27.3, "details_cumul_article_11": "Premier acte facturé à 100%.", "commentaires_specifiques": "Cotation standard pour la pose de sonde urinaire."}
```

**Agent** : Pour la pose de sonde urinaire à Mme Lefebvre ce matin, la cotation est AMI 3, soit 27,30€. Pas de majoration. Confirmez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 43

**System** : _(prompt standard)_

**IDEL** : J'ai fait l'injection de Lovenox de Mme Bertrand ce soir à 20h45. Le trajet depuis le cabinet était de 10km en montagne.

**Agent** → appel outil `analyser_et_coter` :
```json
{"actes": ["AMI"], "patient_id": "Mme Bertrand", "date": "2024-04-22", "heure_soin": "20:45", "type_trajet": "montagne", "distance_km": 10, "patient_bsi_actif": false, "jour_ferie_ou_dimanche": false}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"acte": "AMI 1", "montant_unitaire": 9.1, "majoration": "MAU", "montant_majoration": 9.15, "cumul_applique": "100%"}, {"acte": "IK", "montant_unitaire": 0.8, "quantite": 10, "type_trajet": "montagne", "montant_total": 8.0}], "total_facture": 26.25}
```

**Agent** : Pour l'injection de Mme Bertrand à 20h45 avec 10km en montagne, la cotation est AMI 1 (9,10€) + MAU (9,15€) + IK (8,00€), soit un total de 26,25€. C'est exact ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 44

**System** : _(prompt standard)_

**IDEL** : J'ai fait une injection de Lovenox chez Mme Fournier à 11h15. Elle a un BSI actif et j'ai fait 5km.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Fournier", "date_soin": "2024-03-16", "heure_soin": "11:15", "actes_effectues": [{"description": "injection sous-cutanée de Lovenox", "code_ngap_propose": "AMI 1"}], "patient_bsi_actif": true, "distance_ik_km": 5, "type_terrain_ik": "plaine", "est_dimanche_ou_jour_ferie": false}
```

**Résultat outil** :
```json
{"cotation_details": {"actes": [{"code_ngap": "AMX 1", "description": "Injection sous-cutanée de Lovenox", "coeff": 1, "tarif_unitaire": 9.1, "tarif_total_acte": 9.1, "cumul_article_11": "100%"}], "majorations": [{"code_ngap": "IFD", "description": "Indemnité forfaitaire de déplacement", "tarif": 2.5}], "indemnites_kilometriques": {"distance_km": 5, "type_terrain": "plaine", "tarif_unitaire_km": 0.62, "tarif_total_ik": 3.1}}, "total_facturable": 14.7, "messages_specifiques": ["Conversion AMI 1 en AMX 1 effectuée car le patient a un Bilan de Soins Infirmiers (BSI) actif."]}
```

**Agent** : Pour Mme Fournier, la cotation est AMX 1 + IFD + IK (5km plaine), soit un total de 14,70€. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 45

**System** : _(prompt standard)_

**IDEL** : Bonsoir, je viens de poser une sonde urinaire à M. Michel. Je l'ai fait à 19h45 ce soir.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "M. Michel", "acte_nature": "sonde urinaire", "acte_detail": "pose", "date_soin": "2024-06-18", "heure_soin": "19:45", "patient_bsi_actif": false, "actes_associes": [], "kilometrage": null, "localisation_plain_montagne": null}
```

**Résultat outil** :
```json
{"cotation_detail": [{"code_ngap": "AMI 3", "description": "Pose de sonde urinaire", "quantite": 1, "tarif_unitaire": 27.3, "cumul_coeff": 1.0}], "majorations": [], "total_actes": 27.3, "total_majorations": 0.0, "total_ik": 0.0, "total_facturable": 27.3, "explication": "L'acte de pose de sonde urinaire est coté AMI 3 (27,30 €). L'heure (19h45) et la date (mardi 18 juin 2024) ne donnent droit à aucune majoration de nuit ou de jour férié/dimanche. Pas d'autres actes ou majorations spécifiés."}
```

**Agent** : Pour la pose de sonde urinaire à M. Michel à 19h45, la cotation est AMI 3, soit 27,30 €. C'est correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 46

**System** : _(prompt standard)_

**IDEL** : J'ai fait la glycémie et l'injection d'insuline pour Mme Simon ce matin à 10h.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_name": "Mme Simon", "date": "2025-06-04", "heure_soin": "10:00", "actes": ["AMI 1", "AMI 1"], "patient_bsi_actif": false, "distance_km": 0}
```

**Résultat outil** :
```json
{"total_cotation": 13.65, "details": [{"description": "Glycémie capillaire", "code_ngap": "AMI 1", "tarif_unitaire": 9.1, "coefficient_cumul": 1.0, "tarif_applique": 9.1}, {"description": "Injection d'insuline", "code_ngap": "AMI 1", "tarif_unitaire": 9.1, "coefficient_cumul": 0.5, "tarif_applique": 4.55}], "majorations": [], "indemnites_kilometriques": null, "message": "Cotation calculée avec application de l'article 11."}
```

**Agent** : Pour Mme Simon à 10h : AMI 1 (glycémie) + AMI 1/2 (insuline), soit un total de 13,65 €. Est-ce correct ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 47

**System** : _(prompt standard)_

**IDEL** : J'ai changé la poche de stomie de M. Bernard et fait le pansement complet autour. C'était un soin assez simple mais complet. Je suis passée à 15h45.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Bernard", "soins": [{"description": "changement de poche de stomie et pansement complet", "type_acte_ngap": "Pansement de stomie"}], "date": "2024-11-24", "heure_soin": "15:45", "bsi_actif": false}
```

**Résultat outil** :
```json
{"cotations_detaillees": [{"code": "AMI 3", "tarif_unitaire": 27.3, "quantite": 1, "description": "Pansement de stomie"}, {"code": "MCI", "tarif_unitaire": 9.15, "quantite": 1, "description": "Majoration Dimanche/Jour Férié"}], "total_facturable": 36.45, "resum_texte": "Un AMI 3 pour le pansement de stomie, plus une majoration MCI car le soin a eu lieu un dimanche.", "remarques": "Le 24 novembre 2024 est un dimanche, la majoration MCI a donc été appliquée."}
```

**Agent** : Pour le pansement de stomie de M. Bernard, la cotation proposée est AMI 3 + MCI, car le soin a eu lieu un dimanche à 15h45. Le total est de 36,45€. C'est exact pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 48

**System** : _(prompt standard)_

**IDEL** : Je viens de faire le vaccin grippe à M. Leroy ce matin à 8h15.

**Agent** → appel outil `analyser_et_coter` :
```json
{"actes": ["AMI 1"], "patient_bsi_actif": false, "date": "2025-04-22", "heure_soin": "08:15", "nombre_actes_cumules": 1, "majoration_dimanche_ferie": false, "distance_ik": 0}
```

**Résultat outil** :
```json
{"cotation_details":[{"acte":"AMI 1","prix_unitaire":9.1,"quantite":1,"cumul_pourcentage":100,"prix_final":9.1}],"total_actes":9.1,"majorations":[],"total_majorations":0.0,"indemnites_kilometriques":[],"total_ik":0.0,"montant_total":9.1,"description_cotation":"Injection sous-cutanée ou intramusculaire (vaccination).\nPas de majoration de nuit (MAU) car l'heure (08h15) est après 8h.\nPas de majoration de dimanche/jour férié (MCI) car la date est un mardi."}
```

**Agent** : Pour la vaccination de M. Leroy à 8h15, je propose une cotation de AMI 1 (9,10€). Est-ce exact ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 49

**System** : _(prompt standard)_

**IDEL** : Bonjour, j'ai fait le pansement complexe de M. Garcia ce matin à 8h pile.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "M. Garcia", "date_soin": "2026-03-17", "heure_soin": "08:00", "actes": ["AMI 4"]}
```

**Résultat outil** :
```json
{"acte_principal_code": "AMI 4", "acte_principal_libelle": "Pansement complexe", "tarif_base_acte_principal": 36.4, "majorations": [{"code": "MAU", "libelle": "Majoration d'Acte Unique (nuit 5h-8h)", "montant": 9.15}], "ik_forfait": 0.0, "total_cotation": 45.55, "detail_facturation": "1 x AMI 4 (Pansement complexe) + MAU"}
```

**Agent** : La cotation pour le pansement de M. Garcia à 8h est : AMI 4 + MAU, soit 45,55 €. C'est exact ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 50

**System** : _(prompt standard)_

**IDEL** : Mme Bertrand a eu son pansement post-opératoire simple cet aprèm, je l'ai fait vers 17h15.

**Agent** → appel outil `analyser_et_coter` :
```json
{"patient_nom": "Mme Bertrand", "actes": ["pansement post-opératoire simple"], "heure_soin": "17:15", "date_soin": "2026-01-26"}
```

**Résultat outil** :
```json
{"cotation_detaillee": [{"code": "AMI 2", "description": "Pansement post-opératoire simple", "prix_unitaire": 9.1, "quantite": 1, "total": 9.1}], "total_honoraires": 9.1, "majoration_mau": 0.0, "majoration_mci": 0.0, "majoration_mad": 0.0, "indemnites_kilometriques": 0.0, "prix_total_a_facturer": 9.1, "messages_alertes": []}
```

**Agent** : Pour Mme Bertrand, le pansement post-opératoire simple est un AMI 2, coté 9,10€. C'est correct pour valider cette cotation ?

**Verdict** : OK / KO  
**Commentaire** : 

---

