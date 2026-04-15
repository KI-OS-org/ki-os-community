/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: reputation.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const logger = require('./logger.service');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.KIMBA_METRICS_TABLE || 'kimba_reputation'; // Muss in setup-pki-tables.js ergänzt werden oder manuell angelegt
const REGION = process.env.AWS_REGION || 'eu-central-1';

// Lazy Client
let ddb;
try { ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION })); } catch(e) {}

class ReputationService {
    
    /**
     * Aktualisiert den Score nach einem Job
     * @param {string} entityId - z.B. "worker:excel" oder "model:gpt-5.2"
     * @param {boolean} success - Hat es geklappt?
     * @param {number} latencyMs - Dauer
     * @param {number} userRating - Optional (1-5)
     */
    async updateScore(entityId, success, latencyMs, userRating = null) {
        if (!ddb) return;

        const timestamp = new Date().toISOString();
        
        // Atomares Update in DynamoDB
        const updateExp = [
            'SET last_updated = :now',
            'total_runs = if_not_exists(total_runs, :zero) + :one',
            'latency_sum = if_not_exists(latency_sum, :zero) + :lat',
            success ? 'success_count = if_not_exists(success_count, :zero) + :one' : 'fail_count = if_not_exists(fail_count, :zero) + :one'
        ];
        
        const values = {
            ':now': timestamp,
            ':zero': 0,
            ':one': 1,
            ':lat': latencyMs || 0
        };

        if (userRating) {
            updateExp.push('rating_sum = if_not_exists(rating_sum, :zero) + :rating');
            updateExp.push('rating_count = if_not_exists(rating_count, :zero) + :one');
            values[':rating'] = userRating;
        }

        // Failure Streak Logik
        if (!success) {
            updateExp.push('fail_streak = if_not_exists(fail_streak, :zero) + :one');
        } else {
            updateExp.push('fail_streak = :zero');
        }

        try {
            await ddb.send(new UpdateCommand({
                TableName: TABLE,
                Key: { entityId },
                UpdateExpression: updateExp.join(', '),
                ExpressionAttributeValues: values
            }));
        } catch (e) {
            logger.error('reputation.update_failed', { entityId, message: e.message });
        }
    }

    /**
     * Holt die Scorecard für Routing-Entscheidungen
     */
    async getScorecard(entityId) {
        if (!ddb) return { score: 1.0 }; // Fallback

        try {
            const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { entityId } }));
            const item = res.Item;
            if (!item) return { score: 1.0, fail_streak: 0 }; // Neutraler Startwert

            // Berechne Score (0.0 bis 1.0)
            const total = item.total_runs || 1;
            const successRate = (item.success_count || 0) / total;
            
            // Penalty für Fail-Streak (jeder Fail in Folge zieht 20% ab)
            const streakPenalty = (item.fail_streak || 0) * 0.2;
            
            // Bonus für User Rating
            let ratingBonus = 0;
            if (item.rating_count > 0) {
                const avgRating = item.rating_sum / item.rating_count;
                ratingBonus = (avgRating - 3) * 0.1; // >3 gibt Bonus, <3 Malus
            }

            let finalScore = successRate - streakPenalty + ratingBonus;
            return {
                score: Math.max(0.1, Math.min(1.0, finalScore)), // Clamp 0.1 - 1.0
                fail_streak: item.fail_streak || 0,
                avg_latency: item.latency_sum / total
            };
        } catch (e) {
            return { score: 1.0 }; // Fail-Open
        }
    }

    /**
     * Alias für getScorecard mit model: prefix
     * Genutzt von kcu.router.js
     */
    async getModelReputation(model) {
        return this.getScorecard(`model:${model}`);
    }
}

module.exports = new ReputationService();