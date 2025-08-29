const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const db = require("../../Database");
const BanModel = require("../../Database/models/Ban");

module.exports.commandBase = {
  prefixData: { name: "massban", aliases: ["toplu-ban","mass-ban"] },
  slashData: new SlashCommandBuilder()
    .setName("massban")
    .setDescription("Belirtilen id/mention'ları banlar ve DB'ye kaydeder.")
    .addStringOption(o => o.setName("hedefler").setDescription("ID/mention'ları boşluk ile ayırın").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Ban sebebi").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 5000,
  ownerOnly: false,
  conf: { description: "Toplu ban", usage: "!massban <id id ...> [sebep]" },

  async prefixRun(client, message, args) {
    try {
      if (!message.guild) return message.reply("Bu komut sunucuda kullanılmalıdır.");
      const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(()=>null);
      if (!member || !member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply("Ban yetkisi gerekir.");
      const raw = args.join(" ");
      const parts = raw.split(/\s+/).filter(Boolean);
      const reason = (args.slice(parts.length).join(" ") || "Belirtilmedi").trim();
      if (!parts.length) return message.reply("Lütfen en az bir ID veya mention girin.");

      const conn = await db.init();
      if (!conn) return message.reply("Veritabanı yok, işlem iptal.");

      let doc = null;
      if (conn.type === "mongoose") doc = await BanModel.findOne({ guildId: message.guild.id }).exec().catch(()=>null);
      else doc = await db.getPartnerLow(message.guild.id) ?? { guildId: message.guild.id, bans: [] };

      for (const p of parts) {
        const id = p.replace(/[<@!>]/g, "");
        try {
          await message.guild.members.ban(id, { reason }).catch(()=>null);
          // record
          const entry = { targetId: id, reason, moderatorId: message.author.id, timestamp: new Date() };
          if (conn.type === "mongoose") {
            if (!doc) doc = new BanModel({ guildId: message.guild.id, bans: [entry] });
            else { doc.bans.push(entry); }
            await doc.save().catch(()=>{});
          } else {
            doc = doc || { guildId: message.guild.id, bans: [] };
            doc.bans.push(entry);
            await db.savePartnerLow(doc);
          }
        } catch (e) {
          // continue others
        }
      }

      return message.reply({ content: `Toplu ban işlemi tamamlandı (talimatlı hedef sayısı: ${parts.length}).` });
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "massban", type: "prefix", context: { guildId: message.guild?.id, channelId: message.channel.id, userId: message.author.id } });
      return message.reply("Hata oluştu.");
    }
  },

  async slashRun(client, interaction) {
    try {
      if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const member = interaction.member ?? await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
      if (!member || !member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply({ content: "Ban yetkisi gerekir.", ephemeral: true });

      const raw = interaction.options.getString("hedefler") || "";
      const reason = interaction.options.getString("sebep") || "Belirtilmedi";
      const parts = (raw || "").toString().trim().length ? raw.split(/\s+/).filter(Boolean) : [];
      if (!parts.length) return interaction.editReply({ content: "Lütfen en az bir ID/mention girin.", ephemeral: true });

      const conn = await db.init();
      if (!conn) return interaction.editReply({ content: "Veritabanı yok, işlem iptal.", ephemeral: true });

      let doc = null;
      if (conn.type === "mongoose") doc = await BanModel.findOne({ guildId: interaction.guild.id }).exec().catch(()=>null);
      else doc = await db.getPartnerLow(interaction.guild.id) ?? { guildId: interaction.guild.id, bans: [] };

      for (const p of parts) {
        const id = p.replace(/[<@!>]/g, "");
        try {
          await interaction.guild.members.ban(id, { reason }).catch(()=>null);
          const entry = { targetId: id, reason, moderatorId: interaction.user.id, timestamp: new Date() };
          if (conn.type === "mongoose") {
            if (!doc) doc = new BanModel({ guildId: interaction.guild.id, bans: [entry] });
            else doc.bans.push(entry);
            await doc.save().catch(()=>{});
          } else {
            doc = doc || { guildId: interaction.guild.id, bans: [] };
            doc.bans.push(entry);
            await db.savePartnerLow(doc);
          }
        } catch (e) {
          // continue
        }
      }

      return interaction.editReply({ content: `Toplu ban tamamlandı. Hedef sayısı: ${parts.length}`, ephemeral: true });
    } catch (e) {
      if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "massban", type: "slash", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
      try { if (interaction.deferred || interaction.replied) await interaction.editReply({ content: "Hata oluştu.", ephemeral: true }); else await interaction.reply({ content: "Hata oluştu.", ephemeral: true }); } catch {}
    }
  },
};
