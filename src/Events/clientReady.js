const { ActivityType, Events } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const rest = new REST({ version: "10" }).setToken(client.token);

    client.user.presence.set({
      activities: [
        { name: "Deneniyor.", type: ActivityType.Listening },
      ],
    });

    client.logger.info(`${client.user.username} Active!`);
    // start calisma monitor if configured (non-blocking)
    try {
      const ayarlar = require("../Base/ayarlar.js");
      const calisma = require("../Base/calisma.js");
      const channelId = ayarlar.logChannelId || null;
      if (channelId && typeof calisma.start === "function") {
        calisma.start(client, channelId).catch((e) => client.logger?.warn?.(`Calisma monitor start failed: ${e.message || e}`));
      }
    } catch (e) {
      // ignore if module missing
    }
    /*
      clientReady event:
      - Uygulama başladığında burada client.slashDatas kayıt edilir (global uygulama komutları).
      - Not: Geliştirme sırasında komutları teste özel sunuculara register etmek isterseniz
        Routes.applicationGuildCommands(applicationId, guildId) kullanın.
    */
    try {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: client.slashDatas,
      });
    } catch (error) {
      console.error(error);
    }
  },
};
