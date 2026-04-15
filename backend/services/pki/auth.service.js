/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: auth.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../core/logger.service');

let DynamoDBClient = null, DynamoDBDocumentClient = null, PutCommand = null, GetCommand = null, QueryCommand = null, UpdateCommand = null;
try {
  ({ DynamoDBClient } = require('@aws-sdk/client-dynamodb'));
  ({ DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb'));
} catch(e) {
  logger.warn('[auth.service] AWS SDK nicht installiert — DynamoDB deaktiviert');
}

const REGION = process.env.AWS_REGION || 'eu-central-1';

let _ddb = null;
function getDdb() {
  if (!_ddb && DynamoDBDocumentClient && DynamoDBClient && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  }
  return _ddb;
}

// Simple JWT implementation (use jsonwebtoken in production)
class JWT {
  static sign(payload, secret, expiresIn = '24h') {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    
    const exp = Math.floor(Date.now() / 1000) + this.parseExpiry(expiresIn);
    const payloadWithExp = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
    const payloadB64 = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    
    return `${headerB64}.${payloadB64}.${signature}`;
  }
  
  static verify(token, secret) {
    const [headerB64, payloadB64, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }
    
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    return payload;
  }
  
  static parseExpiry(expiresIn) {
    const match = expiresIn.match(/^(\d+)([hdm])$/);
    if (!match) return 86400; // Default 24h
    
    const [, value, unit] = match;
    const multipliers = { h: 3600, d: 86400, m: 60 };
    return parseInt(value) * multipliers[unit];
  }
}

class MultiUserAuth {
  constructor() {
    this.config = {
      userTable: process.env.PKI_USER_TABLE || 'kimba_users',
      tenantTable: process.env.PKI_TENANT_TABLE || 'kimba_tenants',
      apiKeyTable: process.env.PKI_APIKEY_TABLE || 'kimba_api_keys',
      sessionTable: process.env.PKI_SESSION_TABLE || 'kimba_sessions',
      jwtSecret: process.env.PKI_JWT_SECRET || crypto.randomBytes(32).toString('hex'),
      apiKeyPrefix: 'kim_',
      maxSessionsPerUser: 10,
      sessionTTL: 86400 * 7, // 7 days
      rateLimits: {
        default: { requests: 100, window: 3600 },
        premium: { requests: 1000, window: 3600 },
        enterprise: { requests: 10000, window: 3600 }
      }
    };
    
    this.sessionCache = new Map();
    this.rateLimitCache = new Map();
  }

  // ===== USER MANAGEMENT =====
  async createUser(userData) {
    const userId = userData.userId || crypto.randomUUID();
    const tenantId = userData.tenantId || 'default';
    const timestamp = new Date().toISOString();
    
    const user = {
      userId,
      tenantId,
      email: userData.email,
      username: userData.username || userData.email.split('@')[0],
      passwordHash: userData.password ? await this.hashPassword(userData.password) : null,
      
      profile: {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        avatar: userData.avatar || '',
        language: userData.language || 'de',
        timezone: userData.timezone || 'Europe/Berlin'
      },
      
      settings: {
        emailNotifications: true,
        dataRetention: 90, // days
        shareAnalytics: false,
        ...userData.settings
      },
      
      subscription: {
        plan: userData.plan || 'free',
        status: 'active',
        startDate: timestamp,
        endDate: null,
        limits: this.getPlanLimits(userData.plan || 'free')
      },
      
      auth: {
        mfa: false,
        mfaSecret: null,
        lastLogin: null,
        lastPasswordChange: timestamp,
        failedAttempts: 0,
        locked: false
      },
      
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        lastActivity: timestamp,
        source: userData.source || 'web',
        referrer: userData.referrer || null,
        tags: userData.tags || []
      }
    };

    // Check if user exists
    const existing = await this.getUserByEmail(userData.email, tenantId);
    if (existing) {
      throw new Error('User already exists');
    }

    // Store user
    await getDdb()?.send(new PutCommand({
      TableName: this.config.userTable,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)'
    }));

    // Create default API key
    const apiKey = await this.createApiKey(userId, tenantId, {
      name: 'Default Key',
      permissions: ['read', 'write']
    });

    return {
      user: this.sanitizeUser(user),
      apiKey
    };
  }

  async getUserById(userId, tenantId = 'default') {
    const result = await getDdb()?.send(new GetCommand({
      TableName: this.config.userTable,
      Key: { userId, tenantId }
    }));
    
    return result.Item;
  }

  async getUserByEmail(email, tenantId = 'default') {
    // Would need GSI on email in production
    const result = await getDdb()?.send(new QueryCommand({
      TableName: this.config.userTable,
      IndexName: 'email-index', // Needs to be created
      KeyConditionExpression: 'email = :email AND tenantId = :tenant',
      ExpressionAttributeValues: {
        ':email': email,
        ':tenant': tenantId
      },
      Limit: 1
    }));
    
    return result.Items?.[0];
  }

  async updateUser(userId, tenantId, updates) {
    const updateExpressions = [];
    const expressionValues = {};
    const expressionNames = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      expressionNames[attrName] = key;
      expressionValues[attrValue] = value;
      updateExpressions.push(`${attrName} = ${attrValue}`);
    });

    expressionValues[':now'] = new Date().toISOString();
    updateExpressions.push('#updated = :now');
    expressionNames['#updated'] = 'metadata.updatedAt';

    await getDdb()?.send(new UpdateCommand({
      TableName: this.config.userTable,
      Key: { userId, tenantId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues
    }));
  }

  // ===== AUTHENTICATION =====
  async authenticate(credentials) {
    const { email, password, apiKey, tenantId = 'default' } = credentials;
    
    // API Key authentication
    if (apiKey) {
      return await this.authenticateWithApiKey(apiKey);
    }
    
    // Email/Password authentication
    if (email && password) {
      return await this.authenticateWithPassword(email, password, tenantId);
    }
    
    throw new Error('Invalid credentials');
  }

  async authenticateWithPassword(email, password, tenantId) {
    const user = await this.getUserByEmail(email, tenantId);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    if (user.auth.locked) {
      throw new Error('Account locked');
    }
    
    const validPassword = await this.verifyPassword(password, user.passwordHash);
    
    if (!validPassword) {
      // Increment failed attempts
      await this.updateUser(user.userId, tenantId, {
        'auth.failedAttempts': (user.auth.failedAttempts || 0) + 1,
        'auth.locked': (user.auth.failedAttempts || 0) >= 5
      });
      throw new Error('Invalid credentials');
    }
    
    // Reset failed attempts and update last login
    await this.updateUser(user.userId, tenantId, {
      'auth.failedAttempts': 0,
      'auth.lastLogin': new Date().toISOString()
    });
    
    // Create session
    const session = await this.createSession(user.userId, tenantId);
    
    // Generate tokens
    const accessToken = JWT.sign({
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      plan: user.subscription.plan,
      sessionId: session.sessionId
    }, this.config.jwtSecret, '1h');
    
    const refreshToken = JWT.sign({
      userId: user.userId,
      tenantId: user.tenantId,
      sessionId: session.sessionId,
      type: 'refresh'
    }, this.config.jwtSecret, '7d');
    
    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      sessionId: session.sessionId
    };
  }

  async authenticateWithApiKey(apiKey) {
    const result = await getDdb()?.send(new GetCommand({
      TableName: this.config.apiKeyTable,
      Key: { apiKey }
    }));
    
    if (!result.Item || result.Item.status !== 'active') {
      throw new Error('Invalid API key');
    }
    
    const keyData = result.Item;
    
    // Update last used
    await getDdb()?.send(new UpdateCommand({
      TableName: this.config.apiKeyTable,
      Key: { apiKey },
      UpdateExpression: 'SET lastUsed = :now, #uses = #uses + :one',
      ExpressionAttributeNames: { '#uses': 'uses' },
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':one': 1
      }
    }));
    
    // Get user
    const user = await this.getUserById(keyData.userId, keyData.tenantId);
    
    if (!user || user.subscription.status !== 'active') {
      throw new Error('Invalid API key');
    }
    
    return {
      user: this.sanitizeUser(user),
      apiKey: keyData,
      authenticated: true
    };
  }

  async verifyToken(token) {
    try {
      const payload = JWT.verify(token, this.config.jwtSecret);
      
      // Verify session still valid
      if (payload.sessionId) {
        const session = await this.getSession(payload.sessionId);
        if (!session || session.status !== 'active') {
          throw new Error('Session expired');
        }
      }
      
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // ===== TENANT MANAGEMENT =====
  async createTenant(tenantData) {
    const tenantId = tenantData.tenantId || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    const tenant = {
      tenantId,
      name: tenantData.name,
      domain: tenantData.domain || null,
      
      config: {
        maxUsers: tenantData.maxUsers || 10,
        maxStorage: tenantData.maxStorage || 10737418240, // 10GB
        features: tenantData.features || ['basic'],
        customBranding: tenantData.customBranding || false,
        ssoEnabled: tenantData.ssoEnabled || false
      },
      
      billing: {
        plan: tenantData.plan || 'starter',
        status: 'active',
        billingEmail: tenantData.billingEmail,
        paymentMethod: tenantData.paymentMethod || null
      },
      
      isolation: {
        dataResidency: tenantData.dataResidency || 'eu-central-1',
        encryptionKey: crypto.randomBytes(32).toString('hex'),
        backupEnabled: tenantData.backupEnabled || false
      },
      
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        ownerId: tenantData.ownerId,
        status: 'active'
      }
    };

    await getDdb()?.send(new PutCommand({
      TableName: this.config.tenantTable,
      Item: tenant,
      ConditionExpression: 'attribute_not_exists(tenantId)'
    }));

    // Create tenant-specific tables
    await this.createTenantTables(tenantId);
    
    return tenant;
  }

  async createTenantTables(tenantId) {
    // In production, create isolated DynamoDB tables for each tenant
    // For now, we use prefixed keys in shared tables
    logger.info('pki.tenant.tables.configured', { message: `Tenant tables configured for: ${tenantId}` });
    return true;
  }

  async getTenant(tenantId) {
    const result = await getDdb()?.send(new GetCommand({
      TableName: this.config.tenantTable,
      Key: { tenantId }
    }));
    
    return result.Item;
  }

  // ===== API KEY MANAGEMENT =====
  async createApiKey(userId, tenantId, options = {}) {
    const apiKey = `${this.config.apiKeyPrefix}${crypto.randomBytes(24).toString('hex')}`;
    const timestamp = new Date().toISOString();
    
    const keyData = {
      apiKey,
      userId,
      tenantId,
      name: options.name || 'API Key',
      permissions: options.permissions || ['read'],
      rateLimit: options.rateLimit || this.config.rateLimits.default,
      expiresAt: options.expiresAt || null,
      status: 'active',
      createdAt: timestamp,
      lastUsed: null,
      uses: 0,
      metadata: options.metadata || {}
    };

    await getDdb()?.send(new PutCommand({
      TableName: this.config.apiKeyTable,
      Item: keyData
    }));

    return apiKey;
  }

  async revokeApiKey(apiKey) {
    await getDdb()?.send(new UpdateCommand({
      TableName: this.config.apiKeyTable,
      Key: { apiKey },
      UpdateExpression: 'SET #status = :inactive',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':inactive': 'inactive' }
    }));
  }

  // ===== SESSION MANAGEMENT =====
  async createSession(userId, tenantId) {
    const sessionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    const session = {
      sessionId,
      userId,
      tenantId,
      createdAt: timestamp,
      lastActivity: timestamp,
      expiresAt: new Date(Date.now() + this.config.sessionTTL * 1000).toISOString(),
      status: 'active',
      metadata: {
        userAgent: '',
        ip: '',
        device: ''
      }
    };

    await getDdb()?.send(new PutCommand({
      TableName: this.config.sessionTable,
      Item: session
    }));

    // Cache session
    this.sessionCache.set(sessionId, session);
    
    return session;
  }

  async getSession(sessionId) {
    // Check cache first
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId);
    }
    
    const result = await getDdb()?.send(new GetCommand({
      TableName: this.config.sessionTable,
      Key: { sessionId }
    }));
    
    if (result.Item) {
      this.sessionCache.set(sessionId, result.Item);
    }
    
    return result.Item;
  }

  async invalidateSession(sessionId) {
    await getDdb()?.send(new UpdateCommand({
      TableName: this.config.sessionTable,
      Key: { sessionId },
      UpdateExpression: 'SET #status = :inactive',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':inactive': 'inactive' }
    }));
    
    this.sessionCache.delete(sessionId);
  }

  // ===== RATE LIMITING =====
  async checkRateLimit(identifier, limits = null) {
    const key = `rate:${identifier}`;
    const now = Date.now();
    const window = (limits?.window || this.config.rateLimits.default.window) * 1000;
    const maxRequests = limits?.requests || this.config.rateLimits.default.requests;
    
    // Get current window data
    let windowData = this.rateLimitCache.get(key);
    
    if (!windowData || (now - windowData.start) > window) {
      // New window
      windowData = {
        start: now,
        count: 0
      };
    }
    
    windowData.count++;
    
    if (windowData.count > maxRequests) {
      const resetIn = Math.ceil((window - (now - windowData.start)) / 1000);
      throw new Error(`Rate limit exceeded. Reset in ${resetIn} seconds`);
    }
    
    this.rateLimitCache.set(key, windowData);
    
    return {
      remaining: maxRequests - windowData.count,
      reset: new Date(windowData.start + window).toISOString()
    };
  }

  // ===== UTILITY METHODS =====
  async hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  async verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  sanitizeUser(user) {
    const { passwordHash, auth, ...sanitized } = user;
    return {
      ...sanitized,
      auth: {
        mfa: auth.mfa,
        lastLogin: auth.lastLogin
      }
    };
  }

  getPlanLimits(plan) {
    const limits = {
      free: {
        requests: 100,
        storage: 1073741824, // 1GB
        users: 1,
        features: ['basic']
      },
      starter: {
        requests: 1000,
        storage: 10737418240, // 10GB
        users: 5,
        features: ['basic', 'api']
      },
      professional: {
        requests: 10000,
        storage: 107374182400, // 100GB
        users: 20,
        features: ['basic', 'api', 'advanced', 'analytics']
      },
      enterprise: {
        requests: -1, // unlimited
        storage: -1,
        users: -1,
        features: ['all']
      }
    };
    
    return limits[plan] || limits.free;
  }
}

module.exports = { MultiUserAuth, JWT };
