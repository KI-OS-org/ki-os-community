/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: jobs.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { v4: uuidv4 } = require('uuid');
const logger = require('./core/logger.service');

const TABLE = process.env.KIMBA_JOBS_TABLE || 'kimba_jobs';
const REGION = process.env.AWS_REGION || 'eu-central-1';

let DynamoDBClient = null, DynamoDBDocumentClient = null, PutCommand = null, GetCommand = null, UpdateCommand = null;
let LambdaClient = null, InvokeCommand = null;
try {
  ({ DynamoDBClient } = require('@aws-sdk/client-dynamodb'));
  ({ DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb'));
  ({ LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda'));
} catch(e) {
  logger.warn('[jobs.controller] AWS SDK nicht installiert — DynamoDB/Lambda deaktiviert');
}

// Clients — lazy init nur in AWS Environment
let ddb = null, lambda = null;
function getDdbClient() {
  if (!ddb && DynamoDBDocumentClient && DynamoDBClient && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  }
  return ddb;
}
function getLambdaClient() {
  if (!lambda && LambdaClient && InvokeCommand && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    lambda = new LambdaClient({ region: REGION });
  }
  return lambda;
}

// Local Fallback Store
const localJobs = new Map();

async function createJob(payload) {
    const id = uuidv4();
    const item = {
        job_id: id,
        status: 'pending',
        created_at: new Date().toISOString(),
        payload,
        user_id: payload.userId || 'guest'
    };

    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        await getDdbClient()?.send(new PutCommand({ TableName: TABLE, Item: item }));
    } else {
        localJobs.set(id, item);
        logger.info('jobs.created', { message: `[Local] Job ${id} created.`, jobId: id });
    }
    return id;
}

async function getJob(id) {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        const res = await getDdbClient()?.send(new GetCommand({ TableName: TABLE, Key: { job_id: id } }));
        return res.Item;
    }
    return localJobs.get(id);
}

async function setJobResult(id, result, error = null) {
    const status = error ? 'failed' : 'completed';
    const now = new Date().toISOString();
    
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        await getDdbClient()?.send(new UpdateCommand({
            TableName: TABLE,
            Key: { job_id: id },
            UpdateExpression: 'set #s = :s, updated_at = :u, #o = :o, #e = :e',
            ExpressionAttributeNames: { '#s': 'status', '#o': 'output', '#e': 'error' },
            ExpressionAttributeValues: { ':s': status, ':u': now, ':o': result || {}, ':e': error }
        }));
    } else {
        const job = localJobs.get(id);
        if(job) {
            job.status = status;
            job.output = result;
            job.error = error;
            job.updated_at = now;
        }
    }
}

async function invokeWorker(jobId) {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        const payload = JSON.stringify({
            rawPath: '/__worker',
            httpMethod: 'POST',
            body: JSON.stringify({ job_id: jobId })
        });
        await getLambdaClient()?.send(new InvokeCommand({
            FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
            InvocationType: 'Event',
            Payload: Buffer.from(payload)
        }));
    } else {
        // Lokal simulieren wir den Async Worker
        setTimeout(() => {
            logger.info('jobs.worker.started', { message: `[Local] Starting Worker for ${jobId}`, jobId });
            const { runWorker } = require('./worker');
            runWorker({ job_id: jobId });
        }, 100);
    }
}

async function handleJobsQuery({ id }) {
    if(!id) return { error: 'No ID provided' };
    const job = await getJob(id);
    if(!job) return { error: 'Not found' };
    return job;
}

module.exports = { createJob, getJob, setJobResult, invokeWorker, handleJobsQuery };