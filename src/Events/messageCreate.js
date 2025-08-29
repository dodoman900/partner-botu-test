const { ChannelType, Collection, Events, PermissionFlagsBits } = require("discord.js");
const ayarlar = require("../Base/ayarlar.js");
const db = require("../Database");
const Partner = require("../Database/models/Partner");
const cooldown = new Collection();

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const { client } = message;

    if (message.author.bot) return;
    if (message.channel.type === ChannelType.DM) return;

    // Partner kanalında paylaşım algılama (discord.gg veya invite içeren mesajlar)
    // partner detection
    try {
      await db.init(); // attempt init but continue if null
      const doc = await Partner.findOne({ guildId: message.guild?.id }).catch(()=>null);
      if (doc && Array.isArray(doc.partnerChannels) && doc.partnerChannels.includes(message.channel.id)) {
        const content = (message.content || "").toLowerCase();
        const hasInvite =
          content.includes("discord.gg") ||
          content.includes("discord.com/invite") ||
          content.includes("invite/");
        if (hasInvite || content.includes("http")) {
          // extract possible ids from content to check banned guilds
          const foundIds = (message.content.match(/\d{16,20}/g) || []).slice(0, 5);
          const banned = doc.bannedGuilds || [];
          const isBanned = foundIds.some(
            (id) => banned.includes(id) || banned.includes(message.content),
          );
          if (isBanned) {
            // delete message and notify
            await message.delete().catch(() => {});
            await message.channel
              .send({
                content: `${message.author}, bu sunucu yasaklı olduğu için paylaşımınız silindi.`,
              })
              .catch(() => {});
            return;
          }

          // kayıt: share kaydet
          doc.shares.push({
            userId: message.author.id,
            timestamp: new Date(),
            messageId: message.id,
            channelId: message.channel.id,
          });
          // limit shares array to last 2000
          if (doc.shares.length > 2000) doc.shares = doc.shares.slice(-2000);
          await doc.save().catch(() => {});
          // eğer sayım kanalı ayarlıysa güncelle (opsiyonel: buraya embed gönderme)
          if (doc.counterChannel) {
            const channel = await message.guild.channels.fetch(doc.counterChannel).catch(()=>null);
            if (channel && channel.isTextBased() && channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
              // send a simple counter update (non-spam: replace last message or send new)
              try {
                const userShares = doc.shares.filter(
                  (s) => s.userId === message.author.id,
                );
                const now = Date.now();
                const day = now - 24 * 60 * 60 * 1000;
                const week = now - 7 * 24 * 60 * 60 * 1000;
                const month = now - 30 * 24 * 60 * 60 * 1000;
                const daily = userShares.filter(
                  (s) => new Date(s.timestamp).getTime() > day,
                ).length;
                const weekly = userShares.filter(
                  (s) => new Date(s.timestamp).getTime() > week,
                ).length;
                const monthly = userShares.filter(
                  (s) => new Date(s.timestamp).getTime() > month,
                ).length;
                const total = userShares.length;
                const embed = {
                  title: `Partner paylaşımı kaydedildi: ${message.author.tag}`,
                  fields: [
                    { name: "Günlük", value: `${daily}`, inline: true },
                    { name: "Haftalık", value: `${weekly}`, inline: true },
                    { name: "Aylık", value: `${monthly}`, inline: true },
                    { name: "Toplam", value: `${total}`, inline: true },
                  ],
                  timestamp: new Date(),
                };
                // safe send
                await channel.send({ embeds: [embed] }).catch(()=>{});
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.error("Partner detection error:", e.message || e);
    }

    const { prefix } = ayarlar;
    if (!message.content.startsWith(prefix)) {
      return;
    }

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();

    if (cmd.length === 0) {
      return;
    }

    let command = client.commands.get(cmd);
    command ||= client.commands.get(client.commandAliases.get(cmd));

    if (command) {
      if (command.ownerOnly && !ayarlar.owners.includes(message.author.id)) {
        return message.reply({
          content: "Only my **developers** can use this command.",
        });
      }

      const cmdNameKey =
        command.prefixData?.name ??
        command.slashData?.name ??
        command.conf?.name ??
        cmd;

      try {
        if (command.cooldown) {
          if (cooldown.has(`${cmdNameKey}-${message.author.id}`)) {
            const nowDate = message.createdTimestamp;
            const waitedDate =
              cooldown.get(`${cmdNameKey}-${message.author.id}`) - nowDate;
            return message
              .reply({
                content: `Cooldown is currently active, please try again <t:${Math.floor(
                  new Date(nowDate + waitedDate).getTime() / 1000,
                )}:R>.`,
              })
              .then((msg) =>
                setTimeout(
                  () => msg.delete(),
                  cooldown.get(`${cmdNameKey}-${message.author.id}`) -
                    Date.now() +
                    1000,
                ),
              );
          }

          await command.prefixRun(client, message, args);

          cooldown.set(
            `${cmdNameKey}-${message.author.id}`,
            Date.now() + command.cooldown,
          );

          setTimeout(() => {
            cooldown.delete(`${cmdNameKey}-${message.author.id}`);
          }, command.cooldown);
        } else {
          await command.prefixRun(client, message, args);
        }
      } catch (err) {
        // Logla ve özel event yay
        const errPayload = {
          error: err,
          command: command.prefixData?.name || command.name || "unknown",
          type: "prefix",
          context: {
            guildId: message.guild?.id,
            channelId: message.channel.id,
            userId: message.author.id,
            content: message.content,
          },
        };
        if (message.client && typeof message.client.emit === "function")
          message.client.emit("commandError", errPayload);
        // Kullanıcıya bildirim (genel)
        message
          .reply({
            content: "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
          })
          .catch(() => {});
      }
    }
  },
};

/*
  messageCreate event:
  - Prefix komutları burada işlenir.
  - message.content kullanımı için Gateway Intent: MessageContent gereklidir.
  - Komutlar handlers/command.js tarafından client.commands koleksiyonuna yüklenir.
*/

/*
  messageCreate event:
  - Prefix komutları burada işlenir.
  - message.content kullanımı için Gateway Intent: MessageContent gereklidir.
  - Komutlar handlers/command.js tarafından client.commands koleksiyonuna yüklenir.
*/
