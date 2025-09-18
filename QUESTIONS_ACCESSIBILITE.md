# 🎯 Questions Quiz Accessibilité Web

## 📚 Questions intégrées dans la base SQLite

Voici les 10 questions d'accessibilité web qui ont été ajoutées à votre base de données SQLite :

### Q1. Navigation clavier
**Question :** Quelle est une bonne pratique pour rendre un filtre ou un menu accessible au clavier ?

A. Utiliser des raccourcis clavier spécifiques uniquement pour les utilisateurs avancés  
B. **S'assurer que l'utilisateur peut naviguer avec la touche Tab et activer avec Entrée/Espace** ✅  
C. Rendre le menu invisible pour les lecteurs d'écran  
D. Ajouter un script qui simule les clics de souris automatiquement

---

### Q2. Lien vs Bouton
**Question :** Pourquoi faut-il utiliser un bouton plutôt qu'un lien dans certains cas ?

A. **Parce qu'un bouton permet de déclencher une action comme soumettre un formulaire** ✅  
B. Parce qu'un bouton améliore la vitesse de chargement de la page  
C. Parce qu'un bouton est plus simple à traduire que les liens  
D. Parce qu'un bouton est toujours mieux référencé par Google

---

### Q3. Attributs ARIA
**Question :** Pourquoi ajoute-t-on des aria-label aux éléments comme un logo ou un bouton ?

A. **Pour donner une description claire aux technologies d'assistance (lecteurs d'écran)** ✅  
B. Pour éviter que les éléments soient indexés par les moteurs de recherche  
C. Pour permettre au CSS d'ajouter automatiquement des styles dynamiques  
D. Pour remplacer l'attribut alt des images décoratives

---

### Q4. Liens ouvrant un nouvel onglet
**Question :** Quelle est la bonne pratique lorsqu'un lien ouvre une nouvelle fenêtre ou un nouvel onglet (target="_blank") ?

A. **Prévenir l'utilisateur via un attribut title ou un indicateur visuel** ✅  
B. Masquer le lien aux utilisateurs de lecteurs d'écran  
C. Forcer tous les liens à s'ouvrir en mode impression  
D. Ajouter un mot-clé SEO spécial dans l'URL

---

### Q5. Images
**Question :** Quelle est la bonne pratique concernant l'attribut alt des images ?

A. **Décrire brièvement l'image si elle apporte une information, sinon laisser vide si elle est purement décorative** ✅  
B. Ajouter un alt identique pour toutes les images d'un site  
C. Indiquer le nom du photographe systématiquement  
D. Mettre des hashtags ou mots-clés SEO dans le champ alt

---

### Q6. Vidéos intégrées
**Question :** Comment améliorer l'accessibilité d'une vidéo intégrée via une iframe ?

A. **Ajouter un attribut title indiquant la source ou le contenu** ✅  
B. Forcer l'autoplay avec le son activé  
C. Supprimer les contrôles pour simplifier l'expérience  
D. Ajouter un lien caché vers un site externe non lié

---

### Q7. Mentions légales et accessibilité
**Question :** Pourquoi est-il important que les mentions légales, infos accessibilité et copyright soient présentes dans le colophon (footer) ?

A. **Pour respecter les obligations légales et garantir l'accès rapide à ces informations essentielles** ✅  
B. Pour éviter que le site soit bloqué par les bloqueurs de pub  
C. Pour que les utilisateurs puissent naviguer sans utiliser la barre de recherche  
D. Pour réduire le nombre de pages vues et simplifier les statistiques

---

### Q8. Boutons de consentement (cookies, RGPD)
**Question :** Quelle est la bonne pratique pour rendre des boutons de consentement accessibles ?

A. **Leur donner un aria-label clair décrivant l'action** ✅  
B. Masquer les boutons de refus pour éviter les confusions  
C. Ajouter uniquement une couleur contrastée sans texte  
D. Supprimer les boutons après un délai court

---

### Q9. Multilingue et accessibilité
**Question :** Pourquoi traduire les aria-labels en plusieurs langues (FR/DE/NL) ?

A. **Parce que les lecteurs d'écran doivent restituer l'information dans la langue de l'utilisateur** ✅  
B. Parce que Chrome bloque l'affichage des labels non traduits  
C. Parce que cela permet d'activer automatiquement le mode "voix off"  
D. Parce que sans traduction, les labels ne s'affichent pas sur mobile

---

### Q10. Attributs de navigation (nav, role)
**Question :** Pourquoi est-il important d'utiliser correctement les attributs de navigation (`<nav>`, `role="navigation"`, etc.) ?

A. **Pour permettre aux technologies d'assistance de comprendre et d'annoncer la structure de la page** ✅  
B. Pour empêcher les moteurs de recherche d'indexer la navigation  
C. Pour réduire le temps de chargement de la page  
D. Pour forcer l'utilisation du clavier uniquement

---

## 📊 Statistiques
- **Total questions :** 10
- **Thème :** Accessibilité web
- **Format :** QCM avec 4 choix
- **Base de données :** SQLite locale
- **Status :** ✅ Intégrées et fonctionnelles

## 🚀 Utilisation
Les questions sont maintenant disponibles dans votre application quiz :
- **Frontend :** http://localhost:4200 (participant)
- **Admin :** http://localhost:4200/presentation (maître du jeu)
- **API :** http://localhost:3000/api/questions

## 🔄 Sauvegarde
Ce fichier sert de sauvegarde de vos questions originales. En cas de reset de la base, vous pouvez facilement les réintégrer en utilisant le script `add-questions.js` ou les commandes curl documentées dans `API_EXAMPLES.md`.