/**
 * Service pour mettre à jour les scores des participants
 * sur le serveur via l'API
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScoreSyncService {
  private readonly apiUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}
  
  /**
   * Met à jour le score d'un utilisateur sur le serveur
   * @param userId ID de l'utilisateur
   * @param score Nouveau score
   * @param userName Nom de l'utilisateur (optionnel)
   * @returns Promise résolue lorsque la mise à jour est terminée
   */
  async updateUserScore(userId: string, score: number, userName?: string): Promise<boolean> {
    try {
      console.log(`[SCORE-SYNC] Mise à jour du score pour ${userId}: ${score}`);
      
      const headers = new HttpHeaders({
        'Content-Type': 'application/json'
      });
      
      // Préparer les données pour la mise à jour
      const updateData = {
        userId,
        score,
        userName
      };
      
      // Appeler l'API pour mettre à jour le score
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/participants/${userId}/score`, updateData, { headers })
      );
      
      console.log(`[SCORE-SYNC] ✅ Score mis à jour avec succès pour ${userId}`);
      return true;
    } catch (error) {
      console.error('[SCORE-SYNC] ❌ Erreur lors de la mise à jour du score:', error);
      return false;
    }
  }
  
  /**
   * Met à jour les données complètes d'un utilisateur sur le serveur
   * @param user Objet utilisateur avec ses données complètes
   * @returns Promise résolue lorsque la mise à jour est terminée
   */
  async updateUserData(user: User): Promise<boolean> {
    try {
      console.log(`[SCORE-SYNC] Mise à jour des données pour ${user.id || user.userId}`);
      
      if (!user.id && !user.userId) {
        console.error('[SCORE-SYNC] Impossible de mettre à jour un utilisateur sans ID');
        return false;
      }
      
      // Utiliser l'ID disponible
      const userId = user.id || user.userId;
      
      const headers = new HttpHeaders({
        'Content-Type': 'application/json'
      });
      
      // Normaliser les données pour assurer la compatibilité
      const updateData = {
        ...user,
        // S'assurer que ces champs sont définis correctement
        userId: userId,
        id: userId,
        name: user.name || user.userName,
        userName: user.userName || user.name,
        score: user.score || 0
      };
      
      // Appeler l'API pour mettre à jour les données de l'utilisateur
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/participants/${userId}/score`, updateData, { headers })
      );
      
      console.log(`[SCORE-SYNC] ✅ Données utilisateur mises à jour avec succès pour ${userId}`);
      return true;
    } catch (error) {
      console.error('[SCORE-SYNC] ❌ Erreur lors de la mise à jour des données utilisateur:', error);
      return false;
    }
  }
}