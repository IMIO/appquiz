# Comment résoudre le problème des "Participants Fantômes"

## Description du problème

Notre application Quiz rencontre un problème où d'anciens participants (ou "participants fantômes") apparaissent dans l'interface utilisateur même après avoir réinitialisé le quiz. Ce problème est causé par un mécanisme de cache trop robuste qui était initialement conçu pour maintenir l'état du quiz en cas de problème réseau, mais qui a pour effet secondaire indésirable de réinjecter d'anciens participants dans l'interface même après leur suppression du serveur.

## Solutions implémentées

### 1. Modification de la gestion des listes vides dans quiz-secure.service.ts

Nous avons modifié la logique qui traitait les réponses vides du serveur. Désormais, une liste vide de participants renvoyée par le serveur sera **toujours** considérée comme légitime, au lieu de fallback sur des données en cache.

### 2. Service dédié au nettoyage de cache (CacheCleanerService)

Un nouveau service a été créé spécifiquement pour nettoyer tous les caches liés aux participants:

```typescript
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class CacheCleanerService {
  cleanAllParticipantCaches(silent: boolean = false): void {
    // Nettoie systématiquement tous les caches de participants
  }

  aggressiveCacheCleaning(): void {
    // Nettoyage complet de localStorage et sessionStorage
  }
}
```

### 3. Page de nettoyage de cache (cache-cleaner.html)

Une page HTML accessible à `/public/cache-cleaner.html` a été créée pour permettre aux utilisateurs de nettoyer manuellement le cache en cas de besoin:

- **Nettoyage standard**: Cible uniquement les caches liés aux participants
- **Nettoyage agressif**: Vide complètement localStorage et sessionStorage

### 4. Améliorations de la méthode resetParticipants()

La méthode `resetParticipants()` a été améliorée pour:

- Nettoyer les caches **avant** l'appel API
- Étendre la période de grâce à 30 secondes
- Utiliser le nouveau service CacheCleanerService

## Comment utiliser ces solutions

### En cas de participants fantômes:

1. Accédez à `/cache-cleaner.html` dans votre navigateur
2. Cliquez sur "Nettoyage Standard"
3. Rafraîchissez la page principale de l'application

Si les problèmes persistent:

1. Retournez à `/cache-cleaner.html`
2. Utilisez l'option "Nettoyage Agressif" (attention, cela effacera tous les caches)

### Pour les développeurs:

Lorsque vous implémentez des fonctionnalités qui manipulent les participants:

1. Considérez toujours les listes vides du serveur comme légitimes
2. Utilisez `this.cacheCleaner.cleanAllParticipantCaches()` après chaque réinitialisation
3. Évitez d'ajouter de nouveaux mécanismes de mise en cache sans coordination

## Vérification de l'efficacité

Pour vérifier que la solution fonctionne:

1. Ajoutez quelques participants au quiz
2. Réinitialisez le quiz via le bouton "Redémarrer"
3. Vérifiez qu'aucun participant n'apparaît dans l'interface
4. Rafraîchissez la page et vérifiez à nouveau

Si des participants apparaissent encore, utilisez la page cache-cleaner.html.

---

_Cette documentation sera mise à jour au fur et à mesure des améliorations apportées à la gestion du cache._
