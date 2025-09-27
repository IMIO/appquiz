# Correction - Vérification existence utilisateur côté participant

## Problème identifié

Quand un joueur essayait de rejoindre avec un second compte, le système détectait un userId existant dans le localStorage et le redirigait automatiquement vers la page d'attente, même si cet userId n'existait plus sur le serveur (après un reset par exemple).

**Logs typiques du problème :**

```
User already registered in this session, navigating to waiting...
[WAITING] Vérification participants: participantsCount: 0
```

## Cause racine

Le code de `login.component.ts` vérifiait seulement la présence d'un `userId` dans localStorage, sans valider son existence sur le serveur.

```typescript
// AVANT (problématique)
const existingUserId = localStorage.getItem("userId");
if (existingUserId) {
  console.log("User already registered in this session, navigating to waiting...");
  await this.router.navigate(["/waiting"]);
  return;
}
```

## Solution implémentée

### 1. Vérification côté serveur

Ajout d'une vérification pour s'assurer que l'userId existe encore sur le serveur avant de rediriger :

```typescript
// APRÈS (corrigé)
const existingUserId = localStorage.getItem("userId");
if (existingUserId) {
  console.log("User already registered in localStorage, verifying with server...");

  try {
    const participants = await this.quizService.fetchParticipantsFromServer();
    const userExists = participants.some((participant: User) => participant.id === existingUserId);

    if (userExists) {
      console.log("User confirmed on server, navigating to waiting...");
      await this.router.navigate(["/waiting"]);
      return;
    } else {
      console.log("User not found on server, clearing localStorage and allowing new registration...");
      localStorage.removeItem("userId");
      localStorage.removeItem("userName");
      // Continue with new registration
    }
  } catch (error) {
    console.warn("Error checking user on server, clearing localStorage:", error);
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    // Continue with new registration
  }
}
```

### 2. Nettoyage automatique du localStorage

Si l'userId n'existe plus sur le serveur, le localStorage est automatiquement nettoyé pour permettre une nouvelle inscription.

## Résultat attendu

### Cas 1 : Utilisateur existant valide

- L'userId existe dans localStorage ET sur le serveur
- Redirection vers `/waiting` comme avant
- Comportement inchangé pour les utilisateurs légitimes

### Cas 2 : Utilisateur fantôme (localStorage obsolète)

- L'userId existe dans localStorage mais PAS sur le serveur
- Nettoyage automatique du localStorage
- Possibilité de faire une nouvelle inscription
- Plus de blocage sur la page d'attente avec 0 participants

## Test

1. État serveur : 3 participants (TestUser, Alice, Bob)
2. Simuler un localStorage avec un ancien userId inexistant
3. Tenter de rejoindre → Le système devrait permettre une nouvelle inscription

## Outils de debug

Créé `debug-localstorage.html` pour faciliter les tests :

- Affichage du contenu localStorage
- Boutons pour nettoyer localStorage
- Accès direct à la page participant

## Fichiers modifiés

- `/src/app/participant/login/login.component.ts` : Logique de vérification serveur
- `/debug-localstorage.html` : Outil de debug (nouveau)
