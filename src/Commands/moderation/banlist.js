const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const db = require("../../Database");
const BanModel = require("../../Database/models/Ban");

module.exports.commandBase = {
  prefixData: { name: "banlist", aliases: ["yasaklistesi","ban-liste"] },
  slashData: new SlashCommandBuilder().setName("banlist").setDescription("Sunucudaki ban listesini gösterir."),
  cooldown: 5000,
  ownerOnly: false,
  conf: { description: "Ban listesi", usage: "!banlist" },

  async prefixRun(client, message, args) {
    if (!message.guild) return message.reply("Bu komut sunucuda kullanılmalıdır.");
    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(()=>null);
    if (!member || !member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply("Ban yetkisi gerekir.");
    await showBanList(client, message.guild, message.channel, message.author.id);
  },

  async slashRun(client, interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member ?? await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
    if (!member || !member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply({ content: "Ban yetkisi gerekir.", ephemeral: true });
    await showBanList(client, interaction.guild, interaction.channel, interaction.user.id);
    try { await interaction.editReply({ content: "Ban listesi gönderildi.", ephemeral: true }); } catch {}
  },
};

async function showBanList(client, guild, channel, requesterId) {
  const conn = await db.init();
  let doc = null;
  if (!conn) return channel.send("Veritabanı yok.");
  if (conn.type === "mongoose") doc = await BanModel.findOne({ guildId: guild.id }).exec().catch(()=>null);
  else doc = await db.getPartnerLow(guild.id) || { guildId: guild.id, bans: [] };

  const bans = (doc && doc.bans) ? doc.bans.slice().reverse() : [];
  if (!bans.length) {
    try { await channel.send("Ban kaydı bulunamadı."); } catch { // fallback to DM requestor
      const user = await client.users.fetch(requesterId).catch(()=>null);
      if (user) await user.send("Ban kaydı bulunamadı.").catch(()=>{});
    }
    return;
  }

  const pageSize = 8;
  const pages = [];
  for (let i = 0; i < bans.length; i += pageSize) {
    const chunk = bans.slice(i, i + pageSize);
    const desc = chunk.map(b => `• ${b.targetId} — ${b.reason || "Sebep yok"} — Moderatör: ${b.moderatorId} — ${new Date(b.timestamp).toLocaleString()}`).join("\n\n");
    const embed = new EmbedBuilder().setTitle(`Ban listesi — sayfa ${Math.floor(i/pageSize)+1}`).setDescription(desc).setColor("#AA0000").setTimestamp();
    pages.push(embed);
  }

  const selectorKey = `banlist_page_${guild.id}_${Date.now()}`;
  const options = pages.map((p, idx) => ({ label: `Sayfa ${idx+1}`, description: p.title?.slice(0,50) || `Sayfa ${idx+1}`, value: String(idx) })).slice(0,25);
  const select = new StringSelectMenuBuilder().setCustomId(selectorKey).setPlaceholder("Sayfa seçin").addOptions(options);
  const row = new ActionRowBuilder().addComponents(select);

  // Ensure bot has permission to send in this channel
  let sent = null;
  try {
    const perms = channel.permissionsFor ? channel.permissionsFor(channel.guild.members.me) : null;
    if (!perms || !perms.has("SendMessages")) {
      // fallback to requester DM
      const user = await client.users.fetch(requesterId).catch(()=>null);
      if (user) { await user.send({ embeds: [pages[0]] }).catch(()=>{}); }
      return;
    }
    sent = await channel.send({ embeds: [pages[0]], components: [row] }).catch(() => null);
  } catch {
    // fallback DM
    const user = await client.users.fetch(requesterId).catch(()=>null);
    if (user) await user.send({ embeds: [pages[0]] }).catch(()=>{});
    return;
  }
  if (!sent) return;

  if (!client._banPages) client._banPages = new Map();
  client._banPages.set(selectorKey, pages);
  setTimeout(() => client._banPages.delete(selectorKey), 10*60*1000);
}
