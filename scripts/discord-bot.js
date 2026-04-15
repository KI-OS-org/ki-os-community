/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: scripts/discord-bot.js
 * KIMBA Discord Bot — Slash Commands, Welcome, Automod
 *
 * Start:  node scripts/discord-bot.js
 * PM2:    pm2 start scripts/discord-bot.js --name "kimba-discord"
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
} = require('discord.js');

// ─── Config ────────────────────────────────────────────────────────────────

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  DISCORD_CHANNEL_GENERAL,
  DISCORD_ROLE_COMMUNITY,
  DISCORD_ROLE_BUILDER,
  DISCORD_ROLE_TEAM,
  KI_OS_API_URL = 'http://localhost:8080',
} = process.env;

const REQUIRED = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[KIMBA] Fehler: ${key} fehlt in .env`);
    process.exit(1);
  }
}

// ─── Slash Commands ─────────────────────────────────────────────────────────

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Frag KIMBA — live AI über die KI-OS Engine')
    .addStringOption(opt =>
      opt.setName('question').setDescription('Deine Frage an KIMBA').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('docs')
    .setDescription('KI-OS Dokumentation und Links'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('KI-OS System Status'),
  new SlashCommandBuilder()
    .setName('builder')
    .setDescription('Builder-Rolle selbst zuweisen'),
  new SlashCommandBuilder()
    .setName('roadmap')
    .setDescription('Aktuelle KI-OS Roadmap'),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: COMMANDS }
    );
    console.log('[KIMBA] Slash Commands registriert');
  } catch (err) {
    console.error('[KIMBA] Command-Registrierung fehlgeschlagen:', err.message);
  }
}

// ─── KI-OS API ───────────────────────────────────────────────────────────────

async function callKiOsChat(question, userId) {
  const fetch = require('node-fetch');
  const res = await fetch(`${KI_OS_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': `discord-${userId}`,
      'X-Role': 'community',
    },
    body: JSON.stringify({
      message: question,
      sessionId: `discord-${userId}`,
    }),
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  // Return only the response text — no internal fields exposed
  return data.response || data.answer || data.output || data.text || '(keine Antwort)';
}

async function callKiOsHealth() {
  const fetch = require('node-fetch');
  const res = await fetch(`${KI_OS_API_URL}/health`, { timeout: 5000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Automod ─────────────────────────────────────────────────────────────────

// Patterns für typische Secrets — analog zu gitleaks
const SECRET_PATTERNS = [
  { name: 'OpenAI API Key',     pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'Anthropic API Key',  pattern: /sk-ant-[a-zA-Z0-9\-_]{20,}/ },
  { name: 'GitHub Token',       pattern: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'AWS Access Key',     pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'Discord Token',      pattern: /[MN][a-zA-Z0-9]{23}\.[a-zA-Z0-9\-_]{6}\.[a-zA-Z0-9\-_]{27}/ },
  { name: 'OpenRouter Key',     pattern: /sk-or-[a-zA-Z0-9\-_]{20,}/ },
  { name: 'Generic Secret',     pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["']?[a-zA-Z0-9+\/=_\-]{20,}["']?/i },
];

function detectSecret(content) {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) return name;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunkText(text, max = 4000) {
  const chunks = [];
  while (text.length > max) {
    chunks.push(text.slice(0, max));
    text = text.slice(max);
  }
  if (text.length) chunks.push(text);
  return chunks;
}

function isTeamMember(member) {
  return DISCORD_ROLE_TEAM && member?.roles?.cache?.has(DISCORD_ROLE_TEAM);
}

// ─── Client ──────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ─── Ready ───────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`[KIMBA] Online als ${client.user.tag}`);
  client.user.setActivity('KI-OS | /ask', { type: 2 }); // LISTENING
  await registerCommands();
});

// ─── Welcome ─────────────────────────────────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  try {
    // Community-Rolle auto-zuweisen
    if (DISCORD_ROLE_COMMUNITY) {
      const role = member.guild.roles.cache.get(DISCORD_ROLE_COMMUNITY);
      if (role) await member.roles.add(role).catch(() => {});
    }

    // Welcome-Nachricht in #general
    if (DISCORD_CHANNEL_GENERAL) {
      const channel = member.guild.channels.cache.get(DISCORD_CHANNEL_GENERAL);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('Willkommen bei KI-OS')
          .setDescription(
            `Hey ${member}, schön dass du hier bist!\n\n` +
            `KI-OS ist ein Open-Source AI Operating System für autonome Multi-Agent-Workflows.`
          )
          .addFields(
            {
              name: 'Erste Schritte',
              value:
                '📋 Lies `#rules` — wichtig!\n' +
                '📢 Schau in `#announcements` für News\n' +
                '🔨 Hol dir die **Builder**-Rolle mit `/builder`\n' +
                '❓ Fragen → `#help`',
            },
            {
              name: 'KIMBA fragen',
              value: 'Nutze `/ask <frage>` um direkt mit der KI-OS AI zu sprechen.',
            }
          )
          .setFooter({ text: 'KI-OS · Open Source AI OS · ki-os.org' })
          .setTimestamp();

        await channel.send({ content: `${member}`, embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('[KIMBA] Welcome-Fehler:', err.message);
  }
});

// ─── Automod ─────────────────────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const secretType = detectSecret(message.content);
  if (!secretType) return;

  try {
    await message.delete();
  } catch {
    // Keine Berechtigung zum Löschen — trotzdem warnen
  }

  try {
    const warn = await message.channel.send(
      `⚠️ ${message.author} Deine Nachricht wurde entfernt — möglicher **${secretType}** erkannt.\n` +
      `**Wichtig:** Regeneriere den Credential sofort im jeweiligen Portal.\n` +
      `Bitte lies Regel 2 in <#${process.env.DISCORD_CHANNEL_RULES || 'rules'}>.`
    );
    // Warnung nach 20s selbst löschen
    setTimeout(() => warn.delete().catch(() => {}), 20000);
  } catch (err) {
    console.error('[KIMBA] Automod-Warnung Fehler:', err.message);
  }

  console.log(`[KIMBA] Automod: Secret (${secretType}) von ${message.author.tag} in #${message.channel.name} entfernt`);
});

// ─── Slash Commands ───────────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member } = interaction;

  // ── /ask ──────────────────────────────────────────────────────────────────
  if (commandName === 'ask') {
    await interaction.deferReply();
    const question = interaction.options.getString('question');

    try {
      const answer = await callKiOsChat(question, interaction.user.id);
      const chunks = chunkText(answer, 4000);

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('KIMBA')
        .setDescription(chunks[0])
        .setFooter({ text: 'KI-OS AI Engine' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (const chunk of chunks.slice(1)) {
        await interaction.followUp({ content: chunk });
      }
    } catch (err) {
      await interaction.editReply({
        content: '❌ KIMBA ist gerade nicht erreichbar. Bitte versuche es später erneut.',
        ephemeral: true,
      });
      console.error('[KIMBA] /ask Fehler:', err.message);
    }
  }

  // ── /status ───────────────────────────────────────────────────────────────
  else if (commandName === 'status') {
    await interaction.deferReply();
    const team = isTeamMember(member);

    try {
      const health = await callKiOsHealth();
      const s = health.status || 'unknown';
      const emoji = s === 'ok' ? '🟢' : s === 'degraded' ? '🟡' : '🔴';
      const color = s === 'ok' ? Colors.Green : s === 'degraded' ? Colors.Yellow : Colors.Red;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} KI-OS Status`)
        .addFields(
          { name: 'Status', value: s.toUpperCase(), inline: true },
          { name: 'Version', value: health.os_level || '—', inline: true },
        )
        .setTimestamp();

      // Details nur für Team-Rolle
      if (team && health.checks) {
        const detail = Object.entries(health.checks)
          .map(([k, v]) => `${v?.ok ? '✅' : '❌'} ${k}`)
          .join('\n');
        embed.addFields({ name: 'System Checks', value: detail || '—' });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🔴 KI-OS Status')
        .setDescription('System nicht erreichbar.')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  }

  // ── /docs ─────────────────────────────────────────────────────────────────
  else if (commandName === 'docs') {
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('KI-OS Dokumentation')
      .addFields(
        { name: '📖 GitHub', value: 'https://github.com/KI-OS-org/ki-os' },
        { name: '🌐 Website', value: 'https://ki-os.org' },
        { name: '🚀 Quick Start', value: '`node start-community.js`\noder `START-community.bat` (Windows)' },
        { name: '🔒 Security Issues', value: 'Bitte via `SECURITY.md` oder DM an ein Team-Mitglied melden — nie öffentlich posten.' },
      )
      .setFooter({ text: 'KI-OS v1.5.0 · AGPL-3.0' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  // ── /roadmap ──────────────────────────────────────────────────────────────
  else if (commandName === 'roadmap') {
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('KI-OS Roadmap')
      .addFields(
        {
          name: '✅ v1.5.0 — Current',
          value: 'Ghost Control · Swarm Memory · Voice Loop · Security Gate · Community Distribution',
        },
        {
          name: '🔨 v1.6.0 — Mai 2026',
          value: 'LanceDB Vektorspeicher · Swarm Memory API · Live Demo · AWS SDK Cleanup',
        },
        {
          name: '🔭 v1.7.0',
          value: 'Ghost Vision Re-Planning · State Validation · ε-Greedy Routing',
        },
        {
          name: '🗺️ v1.8.0+',
          value: 'Social Media Connectors · SAP Native · Memory Graph Visualizer',
        },
      )
      .setFooter({ text: 'KI-OS · ki-os.org' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  // ── /builder ──────────────────────────────────────────────────────────────
  else if (commandName === 'builder') {
    if (!DISCORD_ROLE_BUILDER) {
      return interaction.reply({ content: '❌ Builder-Rolle nicht konfiguriert.', ephemeral: true });
    }
    const role = interaction.guild.roles.cache.get(DISCORD_ROLE_BUILDER);
    if (!role) {
      return interaction.reply({ content: '❌ Rolle nicht gefunden.', ephemeral: true });
    }
    if (member.roles.cache.has(DISCORD_ROLE_BUILDER)) {
      return interaction.reply({ content: '✅ Du hast die Builder-Rolle bereits!', ephemeral: true });
    }
    try {
      await member.roles.add(role);
      await interaction.reply({
        content: '🔨 Builder-Rolle zugewiesen! Du hast jetzt Zugang zu `#dev-talk` und `#agent-recipes`.',
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        content: '❌ Rolle konnte nicht zugewiesen werden. Bitte ein Team-Mitglied kontaktieren.',
        ephemeral: true,
      });
      console.error('[KIMBA] /builder Fehler:', err.message);
    }
  }
});

// ─── Error Handling ───────────────────────────────────────────────────────────

client.on('error', (err) => console.error('[KIMBA] Client-Fehler:', err.message));
process.on('unhandledRejection', (err) => console.error('[KIMBA] Unhandled:', err?.message || err));

// ─── Start ────────────────────────────────────────────────────────────────────

client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error('[KIMBA] Login fehlgeschlagen:', err.message);
  process.exit(1);
});
