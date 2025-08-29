const { Collection } = require("discord.js");
const { readdirSync, lstatSync } = require("node:fs");
const path = require("node:path");

module.exports = {
  async execute(client) {
    client.commands = new Collection();
    client.commandAliases = new Collection();
    client.slashCommands = new Collection();
    client.slashDatas = [];

    const commandsPath = path.join(__dirname, "../Commands");

    // Recursive file walker
    function walk(dir) {
      const files = [];
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = lstatSync(full);
        if (stat.isDirectory()) files.push(...walk(full));
        else if (stat.isFile() && name.endsWith(".js")) files.push(full);
      }
      return files;
    }

    let files = [];
    try {
      files = walk(commandsPath);
    } catch (e) {
      const logger = client.logger || console;
      logger.error(`Commands dizini okunamadı: ${commandsPath} — ${e.message || e}`);
      return;
    }

    const prefixLoaded = [];
    const slashLoaded = [];
    const failedLoads = [];

    for (const filePath of files) {
      try {
        const mod = require(filePath);
        let base = null;
        if (mod && mod.commandBase) base = mod.commandBase;
        else if (mod && mod.data && mod.execute) {
          base = {
            slashData: mod.data,
            slashRun: async (client, interaction) => {
              if (mod.execute.length === 1) return await mod.execute(interaction);
              return await mod.execute(interaction, client);
            },
            cooldown: mod.cooldown || 0,
            ownerOnly: mod.ownerOnly || false,
            conf: mod.conf || mod.help || {},
            prefixData: mod.prefixData || null,
            _module: mod,
          };
        } else {
          failedLoads.push({ file: filePath, reason: "unsupported module shape" });
          continue;
        }

        // Attach module ref if available
        try {
          base._module = mod;
        } catch {}

        if (base.prefixData) {
          const pname = base.prefixData.name;
          client.commands.set(pname, base);
          prefixLoaded.push(pname);
          if (Array.isArray(base.prefixData.aliases)) {
            base.prefixData.aliases.forEach((a) => client.commandAliases.set(a, pname));
          }
        }
        if (base.slashData) {
          try {
            client.slashDatas.push(base.slashData.toJSON());
            client.slashCommands.set(base.slashData.name, base);
            slashLoaded.push(base.slashData.name);
          } catch (e) {
            failedLoads.push({ file: filePath, reason: `slashData.toJSON() failed: ${e.message || e}` });
          }
        }
      } catch (e) {
        failedLoads.push({ file: filePath, reason: e && e.stack ? e.stack : String(e) });
      }
    }

    const logger = client.logger || console;
    try {
      logger.info(`Prefix commands loaded (${prefixLoaded.length}): ${prefixLoaded.join(", ") || "none"}`);
      logger.info(`Slash commands loaded (${slashLoaded.length}): ${slashLoaded.join(", ") || "none"}`);
      if (failedLoads.length > 0) {
        logger.warn(`Failed to load ${failedLoads.length} command file(s):`);
        failedLoads.forEach((f) => logger.warn(` - ${f.file}: ${f.reason}`));
      }
    } catch (e) {
      console.log("Komut yükleme özeti yazılırken hata:", e);
    }
  },
};

/*
  Handler expectations (command module exports must match one of these forms):

  module.exports.commandBase = {
    prefixData: { name: "ping", aliases: ["pong"] }, // optional: prefix command
    slashData: new SlashCommandBuilder().setName("ping").setDescription("..."), // optional: slash
    cooldown: 5000, // ms
    ownerOnly: false,
    conf: { // OPTIONAL metadata for docs / help commands
      description: "Pings the bot",
      usage: "!ping",
      examples: ["!ping", "/ping"]
    },
    async prefixRun(client, message, args) { ... },
    async slashRun(client, interaction) { ... }
  }

  - Handlers automatically register prefix and slash commands when present.
  - 'conf' is only metadata and not used for logic by handlers (useful for help/README).
*/