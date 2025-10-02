/**
 * Ce script ajoute des fonctions pour déboguer le chargement des images
 * et force le rafraîchissement de l'interface utilisateur
 */

import { Component, ChangeDetectorRef } from '@angular/core';

export function setupImageDebug(component: any, cdr: ChangeDetectorRef) {
  // Méthode appelée quand une image de question est chargée
  component.onImageLoaded = function() {
    console.log('✅ Image de question chargée avec succès');
    component.imageLoaded = true;
    // Forcer la détection des changements pour s'assurer que l'UI est mise à jour
    cdr.detectChanges();
  };

  // Méthode appelée en cas d'erreur de chargement d'image de question
  component.onImageError = function() {
    console.warn('❌ Erreur de chargement de l\'image:', component.currentQuestion?.imageUrl);
    component.imageLoaded = false;
    // Forcer la détection des changements pour s'assurer que l'UI est mise à jour
    cdr.detectChanges();
  };

  // Méthode appelée quand une image de résultat est chargée
  component.onResultImageLoaded = function() {
    console.log('✅ Image de résultat chargée avec succès');
    component.resultImageLoaded = true;
    // Forcer la détection des changements pour s'assurer que l'UI est mise à jour
    cdr.detectChanges();
  };

  // Méthode appelée en cas d'erreur de chargement d'image de résultat
  component.onResultImageError = function() {
    console.warn('❌ Erreur de chargement de l\'image résultat:', component.currentQuestion?.imageUrlResult);
    component.resultImageLoaded = false;
    // Forcer la détection des changements pour s'assurer que l'UI est mise à jour
    cdr.detectChanges();
  };
}