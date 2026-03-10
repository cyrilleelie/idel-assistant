# Revue : ordonnance

50 exemples à relire. Pour chaque exemple :
- [ ] La question est réaliste (une IDEL pourrait dire ça)
- [ ] La réponse est correcte (cotation, contenu, etc.)
- [ ] Le ton est approprié (concis, professionnel)

---

## Exemple 1

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. David, le docteur a prescrit : une prise de sang, donc une NFS, plus un ionogramme sanguin et la créatinine. À faire une fois par semaine.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'une prise de sang, donc une NFS, plus un ionogramme sanguin et la créatinine. À faire une fois par semaine.', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMB"]}
```

**Agent** : Pour M. David, voici le plan de soins pour le prélèvement sanguin (NFS, ionogramme, créatinine) : 1 acte par semaine, durée estimée 15 min.
Souhaitez-vous que je planifie ces rendez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 2

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Fontaine... une ordonnance un peu chargée. Alors euh, on a un pansement simple, une fois par jour, pendant quinze jours. Ensuite, euh, une piqûre de Lovenox 0.4, tous les jours aussi, mais ça c'est pour dix jours. Ah, et puis, euh, l'aérosolthérapie... Ventoline et Pulmicort, deux fois par jour, pendant une semaine. C'est tout ce que je lis là.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'pansement simple 1x/jour pendant 15 jours + injection Lovenox 0.4ml SC 1x/jour pendant 10 jours + aérosolthérapie Ventoline + Pulmicort 2x/jour pendant 7 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "AMI 1", "AIS 1"]}
```

**Agent** : Pour M. Fontaine, le plan de soins comprend : un pansement simple (AMI 1) pendant 15 jours, une injection Lovenox (AMI 1) pendant 10 jours, et une aérosolthérapie (AIS 1) pendant 7 jours. Voulez-vous que je prépare la création des rendez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 3

**System** : _(prompt standard)_

**IDEL** : Alors pour Mme Martin, euh... C'est une ordonnance d'injection d'insuline Novorapide. Trois fois par jour, avant les repas. Il y a aussi une note disant que la dose dépend de la glycémie, euh, on ajuste quoi. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'Injection insuline Novorapide 3x/jour avant les repas, dose variable selon glycémie', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 2.1"]}
```

**Agent** : Planification pour Mme Martin : 3 injections d'insuline Novorapide par jour avant les repas (AMI 2.1), dose à ajuster selon glycémie. Durée estimée : 5 min par acte. Souhaitez-vous que je planifie ces RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 4

**System** : _(prompt standard)_

**IDEL** : Alors pour Mme Thomas, j'ai une ordonnance... euh, un pansement complexe avec mèche. C'est à faire une fois par jour, pendant trois semaines. Ah et il y a aussi une éducation thérapeutique pour l'autosoin, mais ça c'est hors nomenclature.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'pansement complexe avec mèche 1x/jour pendant 21 jours, éducation thérapeutique', 'patient_id': 'uuid-mme-thomas-001'}
```

**Résultat outil** :
```json
{"actes": ["AMI3", "education_therapeutique"], "patient_id": "uuid-mme-thomas-001"}
```

**Agent** : Pour Mme Thomas, je planifie 21 passages pour un pansement complexe (AMI3) en soins d'infirmiers, 1 fois par jour. Une séance d'éducation thérapeutique est aussi prévue, hors nomenclature. Je peux confirmer pour créer les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 5

**System** : _(prompt standard)_

**IDEL** : Alors, aujourd'hui on a M. Robert... Prescription : BSI, euh, évaluation initiale... Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'BSI évaluation initiale', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMX1"]}
```

**Agent** : Pour M. Robert, je note une évaluation initiale du BSI (AMX1) pour 30 minutes, à faire une fois. Est-ce que je peux planifier ce rendez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 6

**System** : _(prompt standard)_

**IDEL** : Alors, Monsieur David, on a une prescription pour aérosolthérapie... euh, Ventoline et Pulmicort, deux fois par jour pendant une semaine. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'aérosolthérapie Ventoline + Pulmicort 2x/jour pendant 7 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMX 1.2", "AIS 1"]}
```

**Agent** : Pour M. David, je prévois une aérosolthérapie avec Ventoline et Pulmicort, 2 fois par jour pendant 7 jours. Cela correspond aux actes AMX 1.2 et AIS 1. Est-ce que je peux planifier ces RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 7

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Fontaine, j'ai une prescription... voyons voir... Ah oui, c'est une évaluation initiale dans le cadre du BSI. Une seule chose pour l'instant.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'BSI évaluation initiale', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["BSA"]}
```

**Agent** : Ok, j'ai noté pour M. Fontaine : 1 BSA pour l'évaluation initiale du BSI. Je peux programmer ça pour une visite ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 8

**System** : _(prompt standard)_

**IDEL** : Alors là, j'ai une ordonnance pour M. Dupont. Voyons voir... Ah oui, c'est pour l'INR. Il faut faire l'INR deux fois par semaine pendant un mois, puis une fois par semaine. C'est pas très lisible, le stylo a bavé un peu... Ah, je pense que c'est bien ça, 2x/semaine puis 1x/semaine. C'est un traitement de fond je crois, donc ça doit être suivi...

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'INR 2x/semaine pendant 1 mois puis 1x/semaine', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1.5", "AMI 1.5"]}
```

**Agent** : J'ai interprété l'ordonnance pour M. Dupont : 2 prélèvements sanguins (AMI 1.5) par semaine pendant 1 mois, puis 1 prélèvement par semaine ensuite. Dois-je programmer ces actes dès maintenant ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 9

**System** : _(prompt standard)_

**IDEL** : Alors, voyons voir cette ordonnance pour Mme Thomas... injection d'insuline Lantus, vingt unités internationales, sous-cutanée, une fois par jour au coucher. Ensuite, un BSI, évaluation initiale. Et puis, un pansement complexe avec mèche, une fois par jour pendant vingt et un jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'injection insuline Lantus 20UI SC 1x/jour au coucher + BSI évaluation initiale + pansement complexe avec mèche 1x/jour pendant 21 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI1", "AMX1", "AMI3"]}
```

**Agent** : Pour Mme Thomas, je prévois donc une injection d'insuline (AMI1) quotidienne, une évaluation initiale BSI (AMX1), et un pansement complexe (AMI3) pendant 21 jours. Voulez-vous que je planifie ces RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 10

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Robert... J'ai une ordonnance là, euh... C'est un pansement, euh... complexe avec mèche. Et il faut le faire une fois par jour, pendant, je crois, 21 jours. Ah, la signature est un peu difficile à déchiffrer, c'est un peu flou...

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'pansement complexe avec mèche 1x/jour pendant 21 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 4"], "soins_complementaires": [], "total_actes_par_jour": 1, "total_jours": 21, "estimation_duree_totale_jours": 21}
```

**Agent** : Ok, j'ai interprété l'ordonnance pour M. Robert. Il s'agit d'un pansement complexe avec mèche, à réaliser 1 fois par jour pendant 21 jours (AMI 4). Cela représente 1 acte technique par jour pour une durée totale de 21 jours.
Est-ce que je peux confirmer et programmer ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 11

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Dupont, j'ai une prescription pour... euh... soins de stomie et changement d'appareillage, à faire un jour sur deux. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'soins de stomie et changement appareillage 1x/2jours', 'patient_id': 'uuid-fictif-dupont'}
```

**Résultat outil** :
```json
{"actes": ["AIS 3"]}
```

**Agent** : Pour M. Dupont, le plan de soins inclut des soins de stomie et changement d'appareillage (AIS 3), à réaliser un jour sur deux. La durée estimée est de 30 jours. Souhaitez-vous que je planifie ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 12

**System** : _(prompt standard)_

**IDEL** : Alors... euh... Pour M. Fontaine, on a : glycémie capillaire trois fois par jour, et puis une injection d'insuline... euh... alors, 'selon protocole'. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'glycémie capillaire 3x/jour + injection insuline selon protocole', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["BSI", "AMI 2"]}
```

**Agent** : Pour M. Fontaine, je note : 
- Surveillance glycémie capillaire 3x/jour (BSI)
- Injection d'insuline 1x/jour (AMI 2)

Je peux confirmer pour planifier les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 13

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Girard, je note... Hmm, une prescription de pansement simple, à faire une fois par jour. Et ça, c'est pour une durée de 15 jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'pansement simple, 1x/jour pendant 15 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": [{"code": "AIS 1", "libelle": "Soins d\'infirmiers de niveau 1", "frequence": "1 fois par jour", "duree_estimee": "15 jours", "facturation_complementaire": null}], "complement_information": "Prescription simple de pansement."}
```

**Agent** : D'accord, j'ai interprété l'ordonnance pour Mme Girard. Il s'agit d'un pansement simple, une fois par jour pendant 15 jours (équivalent AIS 1 x 15j). Je peux planifier ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 14

**System** : _(prompt standard)_

**IDEL** : Alors là, j'ai une nouvelle ordonnance pour Monsieur Blanc... C'est une perfusion, euh, sous-cutanée. Le produit c'est du NaCl, euh, 500 ml. Il faut la faire une fois par jour pendant cinq jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"patient_id": "uuid-fictif", "actes": ["ISAI"]}
```

**Agent** : Pour M. Blanc, il y a une perfusion sous-cutanée de NaCl 500ml à réaliser 1 fois par jour pendant 5 jours. Cela correspond à un acte ISAI par jour.
Souhaitez-vous que je planifie ces 5 actes ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 15

**System** : _(prompt standard)_

**IDEL** : Alors pour M. Michel, j'ai une ordonnance... alors euh... soins de stomie et changement d'appareillage, une fois tous les deux jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "soins de stomie et changement d'appareillage, une fois tous les deux jours", 'patient_id': 'uuid-fictif-michel'}
```

**Résultat outil** :
```json
{"actes": ["AIS 3"]}
```

**Agent** : M. Michel nécessite des soins de stomie et changement d'appareillage, à planifier un jour sur deux. Cela correspond à un acte AIS 3. Est-ce que je peux valider et programmer ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 16

**System** : _(prompt standard)_

**IDEL** : Alors, euh... pour M. Garcia, c'est... soins de stomie et changement d'appareillage, euh... une fois tous les deux jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "soins de stomie et changement d'appareillage, une fois tous les deux jours", 'patient_id': 'uuid-fictif-garcia'}
```

**Résultat outil** :
```json
{"actes": ["AMX2"], "patient_id": "uuid-fictif-garcia"}
```

**Agent** : Pour M. Garcia, je note : changement appareillage stomie 1x/2 jours (AMX2). Est-ce que je peux planifier ces soins pour les 14 prochains jours ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 17

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Robert... Je note : soins de stomie et changement appareillage, c'est à faire un jour sur deux. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'soins de stomie et changement appareillage, un jour sur deux', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMX3"]}
```

**Agent** : Pour M. Robert, je prévois : 
- Changement de stomie AMX3, 1 fois tous les 2 jours (environ 20 min).
Est-ce que je peux créer les rendez-vous pour ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 18

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Leroy, c'est une prescription... injection de Lovenox, 0.4 ml en sous-cutané, une fois par jour pendant dix jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'injection de Lovenox, 0.4 ml en sous-cutané, une fois par jour pendant dix jours', 'patient_id': 'uuid-fictif-leroy'}
```

**Résultat outil** :
```json
{"actes": ["AMI1"], "patient_id": "uuid-fictif-leroy", "error": null}
```

**Agent** : Plan de soins pour M. Leroy :
- 1 injection de Lovenox 0.4ml SC par jour pendant 10 jours (AMI1).
Est-ce que cela vous convient pour programmer les passages ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 19

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Leroy... ordonnance pour un pansement complexe avec mèche, à faire une fois par jour, pendant trois semaines. Et il faut aussi prévoir une injection d'insuline le matin, et vérifier sa tension artérielle tous les matins aussi.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "pansement complexe avec mèche 1x/jour pendant 21 jours, injection d'insuline le matin, vérification tension artérielle tous les matins", 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 2", "AMI 1", "AIS 1"], "patient_id": "uuid-fictif"}
```

**Agent** : Plan de soins pour M. Leroy : Pansement complexe (AMI 2) 1x/jour pendant 21 jours, injection insuline (AMI 1) et surveillance TA (AIS 1) 1x/jour. Souhaitez-vous que je planifie ces RDV pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 20

**System** : _(prompt standard)_

**IDEL** : Alors, ordonnance pour M. Bernard... Hmm, il faut faire une injection d'insuline Novorapid, trois fois par jour, avant les repas. Ah oui, et c'est en SC, sous-cutanée. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'Injection insuline Novorapid 3x/jour avant les repas SC.', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1"], "patient_id": "uuid-fictif"}
```

**Agent** : Ok pour M. Bernard, l'ordonnance comprend : 3 injections SC d'insuline par jour avant les repas (AMI 1). On valide pour programmer les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 21

**System** : _(prompt standard)_

**IDEL** : Alors, ordonnance pour Madame Roux : injection de Lovenox 0,4 ml, en sous-cutané, une fois par jour, pendant dix jours. Ah, et aussi, un pansement à faire et à surveiller. C'est tout.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'injection Lovenox 0.4ml SC 1x/jour pendant 10 jours, pansement et surveillance', 'patient_id': 'uuid-fictif-mme-roux'}
```

**Résultat outil** :
```json
{"actes": ["AMI1", "AIS3", "AMI1"]}
```

**Agent** : Pour Mme Roux, je prévois donc : 1 injection de Lovenox par jour pendant 10 jours (AMI1), 1 pansement par jour pendant 10 jours (AIS3) et 1 surveillance clinique par jour pendant 10 jours (AMI1). Est-ce que cela vous convient pour que je prépare la planification des RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 22

**System** : _(prompt standard)_

**IDEL** : Alors pour Monsieur David... euh... ordonnance, je note : injection d'insuline Novorapid, trois fois par jour avant les repas. Ah et puis il y a un pansement à faire... je crois que c'est un pansement d'escarre, il faut vérifier le type exact. Et puis surveillance de la tension artérielle. Voilà, c'est tout.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "injection d'insuline Novorapid, trois fois par jour avant les repas. Pansement d'escarre. Surveillance de la tension artérielle.", 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "AIS 1", "AIS 1"]}
```

**Agent** : Voici le plan de soins pour M. David : Pansement complexe (AMI 1), injection d'insuline (3x/jour, AIS 1) et surveillance TA (1x/jour, AIS 1). Voulez-vous que je programme ces RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 23

**System** : _(prompt standard)_

**IDEL** : Alors, j'ai une ordonnance pour Monsieur Michel... Euh, on a une perfusion sous-cutanée de NaCl 500 ml, une fois par jour pendant cinq jours. Ensuite, un pansement complexe avec une mèche, aussi une fois par jour, mais ça, c'est pour vingt-et-un jours. Et pour finir, un pansement simple, une fois par jour, pendant quinze jours. Ah, et il y a aussi un protocole pour l'insuline, à adapter selon la glycémie.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours + pansement complexe avec mèche 1x/jour pendant 21 jours + pansement simple 1x/jour pendant 15 jours + protocole insuline variable selon glycémie', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AIS 3", "AIS 4", "AIS 1", "AIS 4"]}
```

**Agent** : Plan de soins pour M. Michel :
- Perfusion SC NaCl 500ml : AIS 3, 5 jours.
- Pansement complexe avec mèche : AIS 4, 21 jours.
- Pansement simple : AIS 1, 15 jours.
- Protocole insuline à adapter. 

Confirmation pour création des RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 24

**System** : _(prompt standard)_

**IDEL** : Alors... ordonnance pour Mme Girard... c'est une ordonnance multi-soins : euh... BSI, évaluation initiale... puis injection d'insuline Lantus, donc 20 unités, sous-cutanée, une fois par jour au coucher. Et ensuite, un pansement complexe avec mèche, ça, c'est une fois par jour pendant trois semaines. Ah oui, et la patiente est en ALD, donc exonération du ticket modérateur.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'BSI évaluation initiale + injection insuline Lantus 20UI SC 1x/jour au coucher + pansement complexe avec mèche 1x/jour pendant 21 jours. Patiente ALD.', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1.5", "AMX 2.1", "AIS 3.1"]}
```

**Agent** : Ok, pour Mme Girard, je note :
- 1 BSI initial (AMI 1.5).
- Injection d'insuline Lantus 20UI SC, 1x/jour (AMX 2.1).
- Pansement complexe avec mèche, 1x/jour pendant 21 jours (AIS 3.1).

La patiente est en ALD avec exonération.
Je prépare le plan de soins, veux-tu valider avant de créer les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 25

**System** : _(prompt standard)_

**IDEL** : Alors euh... pour M. Dupont, c'est... soins de stomie et changement d'appareillage, à faire une fois tous les deux jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "soins de stomie et changement d'appareillage, à faire une fois tous les deux jours", 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AIS 3"], "patient_id": "uuid-fictif"}
```

**Agent** : Pour M. Dupont, je note : 1 AIS 3 pour soins de stomie et changement d'appareillage, à réaliser tous les 2 jours. Durée estimée à 90 jours. Est-ce que cela vous convient pour planifier les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 26

**System** : _(prompt standard)_

**IDEL** : Alors là, j'ai une ordonnance de sortie pour M. Robert... alors on a pansement complexe avec mèche, à faire une fois par jour pendant 21 jours. Ensuite, on a des prélèvements sanguins, NFS, ionogramme et créatinine, une fois par semaine. Et puis aussi, un pansement simple, une fois par jour pour 15 jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'ordonnance multi-soins : pansement complexe avec mèche 1x/jour pendant 21 jours + prélèvement sanguin NFS + ionogramme + créatinine 1x/semaine + pansement simple 1x/jour pendant 15 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 4", "AMI 3", "AIS 2"]}
```

**Agent** : Pour M. Robert, le plan de soins comprend :
- Pansement complexe avec mèche (AMI 4), 1x/jour pendant 21 jours.
- Prélèvements sanguins (AMI 3), 1x/semaine.
- Pansement simple (AIS 2), 1x/jour pendant 15 jours.

Souhaitez-vous que je crée les rendez-vous correspondants ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 27

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Bernard, le docteur a prescrit un pansement complexe avec mèche, à faire une fois par jour pendant trois semaines. Ah, et c'est pour un patient en ALD, donc avec exonération du ticket modérateur.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'pansement complexe avec mèche 1x/jour pendant 21 jours, patient ALD avec exonération', 'patient_id': 'uuid-fictif-bernard'}
```

**Résultat outil** :
```json
{"actes": ["AMI4"]}
```

**Agent** : Prise en charge de M. Bernard : Pansement complexe avec mèche, 1 fois par jour pendant 21 jours. Le patient est en ALD.
Souhaitez-vous que je planifie ces actes ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 28

**System** : _(prompt standard)_

**IDEL** : Sandrine, j'ai une nouvelle ordonnance pour Mme Bertrand. Alors, il y a... euh... une évaluation initiale BSI, un pansement... je crois que c'est un pansement d'une plaie complexe, une injection sous-cutanée, et puis une surveillance... une surveillance glycémie capillaire. Voilà. C'est pour combien de temps ? Ah oui, la prescription dit... une semaine.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "évaluation initiale BSI, un pansement d'une plaie complexe, une injection sous-cutanée, et puis une surveillance glycémie capillaire. pour une semaine.", 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMX3", "AMI1", "BSC"], "bdi_actif": true, "prescription_duree_jours": 7}
```

**Agent** : Pour Mme Bertrand, voici le plan de soins pour la semaine à venir :
- Soins de plaie complexe (AMX3)
- Injection sous-cutanée (AMI1)
- Surveillance glycémie (BSC)

Chaque acte est prévu une fois par jour pendant 7 jours.
Confirmez-vous pour la création des RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 29

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Roux, j'ai une prescription... perfusion sous-cutanée... de NaCl 500 ml... à faire une fois par jour, pendant cinq jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours', 'patient_id': 'uuid-fictif-mme-roux'}
```

**Résultat outil** :
```json
{"actes": ["AIS 3"]}
```

**Agent** : Ok, j'ai planifié pour Mme Roux : 1 perfusion sous-cutanée par jour pendant 5 jours (AIS 3). Est-ce que je peux valider et créer les rendez-vous pour ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 30

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Fournier... surveillance tension artérielle et pouls, une fois par jour, pendant dix jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'surveillance tension artérielle et pouls, une fois par jour, pendant dix jours.', 'patient_id': 'uuid-fictif-fournier-123'}
```

**Résultat outil** :
```json
{"actes": ["AMI1"]}
```

**Agent** : Plan de soins pour Mme Fournier : 1 AMI1 par jour pendant 10 jours pour surveillance TA et pouls.
Confirmez-vous pour la création des 10 RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 31

**System** : _(prompt standard)_

**IDEL** : Alors, euh, pour Madame Martin, il y a une ordonnance... c'est injection de Lovenox 0,4 ml en sous-cutané, une fois par jour, pendant 10 jours. Et puis, euh, aussi, il y a une note pour de l'éducation thérapeutique, euh, sur la gestion de l'anticoagulant, mais ça, c'est pas un acte NGAP, je crois.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "injection Lovenox 0.4ml SC 1x/jour pendant 10 jours. Éducation thérapeutique sur la gestion de l'anticoagulant.", 'patient_id': 'uuid-fictif-martin'}
```

**Résultat outil** :
```json
{"actes": ["AMI 2.1"], "actes_hors_nomenclature": [{"description": "Éducation thérapeutique sur la gestion de l'anticoagulant"}], "remarques": "Traitement sur 10 jours.", "type_soin": "traitement chronique"}
```

**Agent** : Pour Mme Martin, le plan de soins comprend 10 jours d'injections sous-cutanées de Lovenox (AMI 2.1), ainsi que de l'éducation thérapeutique. Souhaitez-vous que je planifie ces actes et que j'enregistre l'acte d'éducation thérapeutique ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 32

**System** : _(prompt standard)_

**IDEL** : Alors pour Mme Girard, il y a une glycémie capillaire à faire trois fois par jour, et puis aussi une injection d'insuline selon le protocole habituel. Ah, et n'oublie pas, il y a aussi une séance d'éducation thérapeutique concernant le suivi du diabète, je crois que c'est 2 par semaine pendant 1 mois, à noter dans le dossier.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'Pour Mme Girard, glycémie capillaire 3x/jour + injection insuline selon protocole. Éducation thérapeutique diabète 2x/semaine pendant 1 mois.', 'patient_id': 'uuid-fictif-girard'}
```

**Résultat outil** :
```json
{"actes": ["BSI", "AMI 1", "AIS 3"]}
```

**Agent** : Pour Mme Girard, je note : Glycémies capillaires x3/jour (BSI) et injections d'insuline x1/jour (AMI 1). J'ai aussi ajouté les séances d'éducation thérapeutique (AIS 3) à raison de 2 fois par semaine sur 1 mois. Est-ce que je peux créer les RDV pour cela ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 33

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Leroy, c'est aérosolthérapie Ventoline et Pulmicort, deux fois par jour, pendant sept jours. Tu notes ?

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'aérosolthérapie Ventoline + Pulmicort 2x/jour pendant 7 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": [{"code": "AMX1", "libelle": "Soins d\'inhalation, d\'aérosolthérapie ou de nébulisation par appareil à usage unique", "frequence": "2 fois par jour", "duree_jours": 7, "cumulable": false, "coefficient": 1, "indemnite_forfaitaire": 0, "majorations": null, "type": "actes_de_soins"}]}
```

**Agent** : OK pour M. Leroy. Je retiens 2 séances d'aérosolthérapie (AMX1) par jour pendant 7 jours.

Cela vous convient ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 34

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Bernard... il faut faire une évaluation initiale BSI. Et euh... il y a aussi une séance d'éducation thérapeutique, euh, une fois par semaine, je crois que c'est une durée de 30 minutes. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "Pour M. Bernard, évaluation initiale BSI et une séance d'éducation thérapeutique par semaine, durée 30 minutes.", 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMX1", "AMA 5"]}
```

**Agent** : J'ai identifié pour M. Bernard : une évaluation initiale BSI (AMX1) et une séance d'éducation thérapeutique par semaine (AMA 5 HN, 30 min). Je prévois 1 visite pour l'AMX1 et 1 visite/semaine pour l'AMA 5. Souhaitez-vous que je planifie ces actes ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 35

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Thomas... voyons voir... surveillance tension artérielle et pouls, un fois par jour pendant... dix jours. Hmm, c'est une ordonnance de renouvellement, il y avait une modification de posologie, je crois. Ah oui, c'est ça.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'surveillance TA + pouls 1x/jour pendant 10 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": [{"code": "AMI 1", "libelle": "Visite d\'infirmière à domicile", "frequence": "1/jour", "duree_estimee_jours": 10}], "informations_complementaires": {"renouvellement": true, "modification_posologie": true}}
```

**Agent** : Ok Isabelle, pour Mme Thomas, voici le plan de soins interprété : 1 visite à domicile par jour (AMI 1) pendant 10 jours pour surveillance TA et pouls. L'ordonnance est un renouvellement avec modification de posologie. Souhaitez-vous que je planifie ces RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 36

**System** : _(prompt standard)_

**IDEL** : Alors, euh... Pour Mme Lefebvre, il y a une prescription : surveillance de la tension artérielle et des pouls, euh... une fois par jour, pendant 10 jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'surveillance TA + pouls 1x/jour pendant 10 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI1"]}
```

**Agent** : Pour Mme Lefebvre, je planifie donc 10 visites pour une surveillance TA/pouls.
Cela correspond à 10 AMI1.
Confirmez-vous pour la création des RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 37

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Fournier... euh... attendez... Ah oui. C'est marqué... 'Surveillance TA et pouls'. Euh... je crois qu'il y a un '1x' devant... oui, '1x par jour' et puis '10 jours'. Je vois pas grand-chose d'autre sur ce papier, c'est un peu brouillon.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'Surveillance TA et pouls 1x/jour pendant 10 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1"], "duree_totale_jours": 10, "soins_complementaires": "surveillance TA et pouls"}
```

**Agent** : Pour Mme Fournier, voici le plan de soins basé sur l'ordonnance : 1 AMI 1 par jour pendant 10 jours pour surveillance TA et pouls.
Souhaitez-vous que je planifie ces 10 passages ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 38

**System** : _(prompt standard)_

**IDEL** : Alors Valérie, j'ai une nouvelle prescription pour Monsieur Laurent. C'est... euh... surveillance de la tension artérielle et du pouls, une fois par jour, pendant dix jours. Ah, et il y a aussi un pansement à faire sur le bras droit, et une injection d'insuline. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "surveillance de la tension artérielle et du pouls, une fois par jour, pendant dix jours. pansement sur le bras droit, et une injection d'insuline.", 'patient_id': 'uuid-fictif-m-laurent'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "AIS 3", "AMI 2.5"]}
```

**Agent** : Pour M. Laurent, je planifie : une surveillance TA/pouls (AMI 1) pendant 10 jours, un pansement (AIS 3) et une injection d'insuline (AMI 2.5) chaque jour.
Cela fait un total de 3 actes quotidiens. Souhaitez-vous que je crée les rendez-vous pour ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 39

**System** : _(prompt standard)_

**IDEL** : Alors, pour Madame Simon, c'est une perfusion sous-cutanée, NaCl 500ml, une fois par jour, pendant 5 jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1"], "informations_complementaires": {"solute": "NaCl 500ml"}}
```

**Agent** : Pour Mme Simon, je planifie 5 actes AMI 1 pour une perfusion sous-cutanée (NaCl 500ml), à réaliser une fois par jour. Est-ce que je peux confirmer pour créer ces 5 rendez-vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 40

**System** : _(prompt standard)_

**IDEL** : Alors Sandrine, là j'ai une ordonnance pour Mme Martin. Euh, c'est du multi-soins. Alors : BSI évaluation initiale, ensuite euh, injection de Lovenox, euh, 0.4 ml en sous-cutané, une fois par jour, pendant 10 jours. Et puis, euh, prélèvement sanguin, une fois par semaine, euh, la NFS, l'ionogramme et la créatinine. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'BSI évaluation initiale + injection Lovenox 0.4ml SC 1x/jour pendant 10 jours + prélèvement sanguin NFS + ionogramme + créatinine 1x/semaine', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "AMI 2", "BI 1"]}
```

**Agent** : Pour Mme Martin, je note : BSI évaluation initiale (AMI 1), puis injections Lovenox 10 jours (AMI 2 x 10), et prélèvements sanguins hebdomadaires (BI 1 x 4 semaines). Est-ce que je peux créer les RDV correspondants ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 41

**System** : _(prompt standard)_

**IDEL** : Alors, alors... pour Monsieur Dupont, euh... il faut faire une surveillance de la tension artérielle et du pouls, une fois par jour, pendant 10 jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'surveillance TA + pouls 1x/jour pendant 10 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMX 1.3"]}
```

**Agent** : Pour M. Dupont, je planifie 10 jours de surveillance TA et pouls, 1 fois par jour (AMX 1.3). Est-ce que je peux créer ces rendez-vous sur le calendrier ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 42

**System** : _(prompt standard)_

**IDEL** : Alors, Sandrine, j'ai une nouvelle prescription pour Mme Simon... toilette et habillage, une fois par jour, patient en GIR 2. Ah, et je crois qu'elle estALD, avec exonération du ticket modérateur.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'toilette + habillage 1x/jour patient GIR 2, patient ALD avec exonération', 'patient_id': 'uuid-fictif-mme-simon'}
```

**Résultat outil** :
```json
{"actes": ["AIS 3"]}
```

**Agent** : Pour Mme Simon, je planifie donc une toilette avec aide à l'habillage, 1 fois par jour. Ce soin est adapté à son GIR 2 et à son statut ALD avec exonération.
Est-ce que cela vous convient pour que je crée les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 43

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Garcia... on a une surveillance de la tension et des pouls, une fois par jour, pendant 10 jours. Ensuite, il y a une perfusion sous-cutanée... je crois que c'est du NaCl 500ml, une fois par jour aussi, mais ça, c'est sur 5 jours. Et pour finir, un prélèvement sanguin, NFS, ionogramme et créatinine, une fois par semaine. Voilà, je crois que c'est tout... ah, et je vois aussi un petit truc écrit là, je pense que c'est 'traitement' mais c'est pas clair du tout. Je vais laisser ça de côté pour le moment.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'surveillance TA + pouls 1x/jour pendant 10 jours + perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours + prélèvement sanguin NFS + ionogramme + créatinine 1x/semaine', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "AIS 3", "NGAM 1.2"]}
```

**Agent** : Pour M. Garcia, voici le plan de soins : Surveillance TA/pouls 1x/jour (10j), Perfusion SC NaCl 500ml 1x/jour (5j), Prélèvement sanguin (NFS, iono, créat) 1x/semaine. Est-ce que je peux créer les RDV pour ces actes ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 44

**System** : _(prompt standard)_

**IDEL** : Alors, j'ai une nouvelle ordonnance pour Mme Roux... euh, donc c'est une évaluation initiale BSI, plus une aérosolthérapie avec Ventoline et Pulmicort, deux fois par jour pendant sept jours. Ah et aussi, une injection de Lovenox, zéro-quatre millilitres en sous-cutané, une fois par jour pendant dix jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'évaluation initiale BSI + aérosolthérapie Ventoline + Pulmicort 2x/jour pendant 7 jours + injection Lovenox 0.4ml SC 1x/jour pendant 10 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "AMI 2", "AMI 1"]}
```

**Agent** : Pour Mme Roux, je note : 1 évaluation BSI, 7 jours d'aérosols 2x/jour, et 10 jours d'injections Lovenox 0.4ml SC 1x/jour. Est-ce que je peux créer les RDV pour ces soins ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 45

**System** : _(prompt standard)_

**IDEL** : Alors, pour Mme Lefebvre... euh... attendez, je relis... Injection d'insuline Lantus, 20 unités... euh... sous-cutanée, une fois par jour, le soir au coucher. Ah, et puis il y a aussi une note pour une éducation thérapeutique sur l'auto-injection, je pense. C'est tout.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': "Injection d'insuline Lantus 20UI SC 1x/jour au coucher. Éducation thérapeutique sur l'auto-injection.", 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "NEC 1"], "informations_complementaires": {"nom_patient": "Mme Lefebvre", "date_ordonnance": "2026-07-09"}}
```

**Agent** : Pour Mme Lefebvre, je planifie : 1 injection d'insuline par jour (AMI 1) et 1 séance d'éducation thérapeutique sur l'auto-injection (NEC 1). La durée totale par jour serait d'environ 5-10 minutes pour l'injection et la séance d'éducation. Confirmez-vous pour la création des RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 46

**System** : _(prompt standard)_

**IDEL** : Alors, euh... pour Madame Roux, j'ai une prescription : c'est un pansement simple, à faire une fois par jour pendant... 15 jours.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'pansement simple 1x/jour pendant 15 jours', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMS 4"]}
```

**Agent** : Ok, j'ai interprété l'ordonnance pour Mme Roux. Il s'agit d'un acte d'Application de pansement usuel (AMS 4) à faire une fois par jour pendant 15 jours.
Je peux programmer ça ? Confirmation avant création des RDV.

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 47

**System** : _(prompt standard)_

**IDEL** : Alors, ordonnance pour Mme Thomas... Elle a une surveillance de sa tension artérielle, et des pouls, à faire une fois par jour pendant dix jours. Ah, et il y a aussi une éducation thérapeutique pour l'aider à mieux gérer sa condition sur le long terme.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'surveillance TA + pouls 1x/jour pendant 10 jours + éducation thérapeutique', 'patient_id': 'uuid-fictif-mme-thomas'}
```

**Résultat outil** :
```json
{"actes": ["AMX1", "SAE"], "duree_traitement_jours": 10}
```

**Agent** : Pour Mme Thomas, voici le plan de soins proposé : Surveillance TA et pouls (AMX1) 1 fois par jour pendant 10 jours, et un soin d'accompagnement éducatif (SAE) 1 fois par jour aussi. Les SAE sont hors nomenclature mais importants pour le suivi. Souhaitez-vous que je planifie ces actes ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 48

**System** : _(prompt standard)_

**IDEL** : Alors pour M. Blanc, j'ai une ordonnance multi-soins. Il faut faire une évaluation initiale BSI, donc un AMI 1. Ensuite, une perfusion sous-cutanée de NaCl 500 ml, une fois par jour, pendant 5 jours. Ça, c'est un BSB. Et puis, une glycémie capillaire trois fois par jour, donc trois BSI. Ah oui, et une injection d'insuline selon protocole. Et puis, il y a une éducation thérapeutique aussi, mais ça, c'est hors nomenclature.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'Pour M. Blanc, évaluation initiale BSI, perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours, glycémie capillaire 3x/jour, injection insuline selon protocole. Éducation thérapeutique HORS NGAP.', 'patient_id': 'uuid-fictif'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1", "BSB", "BSI", "Protokol INSULINE"], "actes_hors_ngap": [{"description": "Éducation thérapeutique"}]}
```

**Agent** : Voici le plan de soins pour M. Blanc : Évaluation BSI (AMI 1), perfusion SC NaCl 500ml (BSB) x5j, glycémie capillaire 3x/jour (BSI) et injection insuline selon protocole. L'éducation thérapeutique sera notée hors NGAP. Souhaitez-vous que je planifie les RDV ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 49

**System** : _(prompt standard)_

**IDEL** : Alors, pour M. Leroy, c'est... euh... une glycémie capillaire trois fois par jour, et puis une injection d'insuline... euh, selon le protocole. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'glycémie capillaire 3x/jour + injection insuline selon protocole', 'patient_id': 'uuid-fictif-leroy'}
```

**Résultat outil** :
```json
{"actes": ["BSB", "AMI 2"]}
```

**Agent** : Voici le plan de soins pour M. Leroy :
- Surveillance glycémie capillaire (BSB) 3 fois par jour.
- Injection d'insuline (AMI 2) 1 fois par jour.

Est-ce que je peux planifier ces actes pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

## Exemple 50

**System** : _(prompt standard)_

**IDEL** : Alors là, j'ai une ordonnance pour Mme Lefebvre... euh, attendez, je lis : Injection de Lovenox, 0.4 ml, en sous-cutané, une fois par jour, pendant dix jours. Voilà.

**Agent** → appel outil `interpreter_ordonnance` :
```json
{'texte_ordonnance': 'Injection de Lovenox, 0.4 ml, en sous-cutané, une fois par jour, pendant dix jours.', 'patient_id': 'uuid-fictif-lefebvre'}
```

**Résultat outil** :
```json
{"actes": ["AMI 1"]}
```

**Agent** : Pour Mme Lefebvre, je prévois 10 jours de soins pour une injection sous-cutanée (AMI 1) par jour. Je peux planifier ces RDV dès maintenant pour vous ?

**Verdict** : OK / KO  
**Commentaire** : 

---

