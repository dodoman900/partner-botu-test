module.exports = {
  execute(client) {
    const handleError = (type, error) => {
      console.error(`${type}: ${error.stack || error.message}`);
    };

    const processEvents = {
      unhandledRejection: "Unhandled promise rejection",
      uncaughtException: "Uncaught exception",
      uncaughtExceptionMonitor: "Uncaught exception monitored",
    };

    for (const [event, message] of Object.entries(processEvents)) {
      process.on(event, (error) => handleError(message, error));
    }

    // Komut hatalarını dinle ve bildirim gönder
    client.on("commandError", async (payload) => {
      try {
        // store last error summary on client for monitoring
        client._lastError = { at: Date.now(), payload };

        const { error, command, type, context } = payload;
        const stack = (error && (error.stack || error.message)) || String(error);
        const { guildId, channelId, userId } = context || {};

        // Oluşturulacak rapor embed'i
        const { EmbedBuilder } = require("discord.js");
        const ayarlar = require("../Base/ayarlar.js");
        const embed = new EmbedBuilder()
          .setTitle("Command Error Report")
          .setColor("#FF5555")
          .addFields(
            { name: "Command", value: String(command || "unknown"), inline: true },
            { name: "Type", value: String(type || "unknown"), inline: true },
            { name: "Guild", value: guildId ? String(guildId) : "DM/unknown", inline: true },
            { name: "Channel", value: channelId ? String(channelId) : "unknown", inline: true },
            { name: "User", value: userId ? String(userId) : "unknown", inline: true },
            { name: "Error", value: stack.length > 1024 ? stack.slice(0, 1000) + "..." : stack, inline: false }
          )
          .setTimestamp();

        // Öncelikle belirtildi ise hata kanalı (HATA_KANALI)
        if (ayarlar.hataChannelId) {
          const ch = await client.channels.fetch(ayarlar.hataChannelId).catch(() => null);
          if (ch && ch.send) {
            await ch.send({ embeds: [embed] }).catch(() => {});
            return;
          }
        }

        // Öncelikle belirtildi ise log kanalına gönder (eski davranış)
        if (ayarlar.logChannelId) {
          const ch2 = await client.channels.fetch(ayarlar.logChannelId).catch(() => null);
          if (ch2 && ch2.send) {
            await ch2.send({ embeds: [embed] }).catch(() => {});
            return;
          }
        }

        // Aksi halde sahip(ler)e DM ile gönder
        if (Array.isArray(ayarlar.owners)) {
          for (const ownerId of ayarlar.owners) {
            try {
              const owner = await client.users.fetch(ownerId).catch(() => null);
              if (owner) await owner.send({ embeds: [embed] }).catch(() => {});
            } catch {}
          }
        } else {
          console.error("No owners configured to receive command error reports.");
          console.error(stack);
        }
      } catch (e) {
        console.error("Error while handling commandError event:", e);
      }
    });
  },
};
