const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../Database");

module.exports.commandBase = {
  prefixData: { name: "baskin-gecmis", aliases: ["baskingecmis"] },
  slashData: new SlashCommandBuilder()
    .setName("baskin-gecmis")
    .setDescription("Sunucudaki baskın geçmişini gösterir (8 perm gerekli)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ADMINISTRATOR),
  
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true });
    
    const member = interaction.member;
    if (!member.permissions.has(PermissionFlagsBits.ADMINISTRATOR)) {
      return interaction.reply({ content: "Bu komutu kullanmak için yönetici yetkisine sahip olmalısınız.", ephemeral: true });
    }

    const conn = await db.init();
    let reports = [];
    
    if (conn.type === "lowdb") {
      reports = (await db.getBaskinLow(interaction.guild.id)) || [];
    }

    if (!reports.length) {
      return interaction.reply({ content: "Bu sunucuda kayıtlı baskın bildirimi bulunmuyor.", ephemeral: true });
    }

    let currentPage = 0;
    const pages = this.createReportPages(reports, interaction.guild);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("◀")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("▶")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pages.length <= 1)
    );

    const reply = await interaction.reply({ 
      embeds: [pages[0]], 
      components: [row],
      ephemeral: true 
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300000
    });

    collector.on("collect", async i => {
      if (i.customId === "prev_page") {
        currentPage--;
      } else if (i.customId === "next_page") {
        currentPage++;
      }

      row.components[0].setDisabled(currentPage === 0);
      row.components[1].setDisabled(currentPage === pages.length - 1);

      await i.update({ embeds: [pages[currentPage]], components: [row] });
    });
  }
};
