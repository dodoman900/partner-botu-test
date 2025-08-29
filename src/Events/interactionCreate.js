const { Collection, Events, InteractionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require("discord.js");
const ayarlar = require("../Base/ayarlar.js");
const cooldown = new Collection();
const path = require("node:path");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const { client } = interaction;

    // Buton tıklamalarını işle
    if (interaction.isButton()) {
      try {
        if (interaction.customId === "baskin_confirm") {
          // Kullanıcı onayladı -> modal göster
          const modal = new ModalBuilder()
            .setCustomId("baskin_ids_modal")
            .setTitle("Baskın ID'leri");

          const idsInput = new TextInputBuilder()
            .setCustomId("ids_input")
            .setLabel("Baskıncı ID'leri (boşluk ile ayırın)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Örnek: 123456789012345678 987654321098765432")
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(idsInput));

          await interaction.showModal(modal);
        } else if (interaction.customId === "baskin_cancel") {
          // İptal
          await interaction
            .update({
              content: "Baskın bildirimi iptal edildi.",
              components: [],
              ephemeral: true,
            })
            .catch(() => {});
        }
      } catch (e) {
        console.error("Button handling error:", e);
        // emit error
        if (client && typeof client.emit === "function")
          client.emit("commandError", {
            error: e,
            command: "baskin-bildir-button",
            type: "button",
            context: {
              guildId: interaction.guild?.id,
              channelId: interaction.channelId,
              userId: interaction.user.id,
            },
          });
      }
      return;
    }

    // Modal submit handling
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      if (interaction.customId === "baskin_ids_modal") {
        try {
          // Eğer modal bir DM'de açıldıysa guild olmayacaktır — bunu engelle
          if (!interaction.guild) {
            await interaction.reply({ content: "Bu komut sunucuda kullanılmalıdır.", ephemeral: true }).catch(() => {});
            return;
          }

          // Acknowledge modal submit so we can followUp later
          await interaction.deferReply({ ephemeral: true });

          const idsRaw = interaction.fields.getTextInputValue("ids_input");
          const ids = idsRaw
            .split(/[\s,]+/)
            .map((i) => i.trim())
            .filter(Boolean);
          if (!ids.length) {
            await interaction.followUp({
              content: "Geçerli ID bulunamadı. İşlem iptal edildi.",
              ephemeral: true,
            });
            return;
          }

          // Try to get command module safely:
          let cmdModule = null;
          // 1) Try to get registered slash command and its original module
          try {
            const cmdBase = client.slashCommands.get("baskin-bildir");
            if (cmdBase) {
              if (cmdBase.handleReport && typeof cmdBase.handleReport === "function") {
                // commandBase may already have handleReport attached
                cmdModule = { handleReport: cmdBase.handleReport };
              } else if (cmdBase._module && typeof cmdBase._module.handleReport === "function") {
                cmdModule = cmdBase._module;
              }
            }
          } catch (e) {
            // ignore and fallback to require
          }

          // 2) Fallback: try require using resolved paths (supporting special chars)
          if (!cmdModule) {
            try {
              // prefer path with Turkish chars if file exists
              cmdModule = require(path.join(__dirname, "../Commands/info/baskın-bildir.js"));
            } catch (e1) {
              try {
                // ascii fallback
                cmdModule = require(path.join(__dirname, "../Commands/info/baskin-bildir.js"));
              } catch (e2) {
                cmdModule = null;
              }
            }
          }

          if (cmdModule && typeof cmdModule.handleReport === "function") {
            await cmdModule.handleReport(
              client,
              interaction.guild,
              interaction.user,
              ids,
              "slash",
              interaction,
            );
          } else {
            throw new Error("handleReport fonksiyonu bulunamadı veya yüklü değil.");
          }
        } catch (e) {
          console.error("Modal submit handling error:", e);
          if (client && typeof client.emit === "function")
            client.emit("commandError", {
              error: e,
              command: "baskin-bildir-modal",
              type: "modal",
              context: {
                guildId: interaction.guild?.id,
                channelId: interaction.channelId,
                userId: interaction.user.id,
              },
            });
          try {
            await interaction.followUp({
              content: "Bir hata oluştu, yetkililere bildirildi.",
              ephemeral: true,
            });
          } catch {}
        }
        return;
      }
    }

    // Select menu handling: calisma monitor select (pages)
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      if (customId && customId.startsWith("calisma_select_")) {
        try {
          const channelId = customId.split("_").slice(2).join("_");
          const monitors = client._calismaMonitors || new Map();
          const monitor = monitors.get(channelId);
          if (!monitor) return interaction.reply({ content: "Monitör bulunamadı veya süresi dolmuş.", ephemeral: true });

          // izin kontrol: sadece yöneticiler veya sahipler seçebilir
          if (interaction.user.id !== monitor.ownerId && !ayarlar.owners.includes(interaction.user.id)) {
            return interaction.reply({ content: "Bu işlemi yalnızca monitörü oluşturan kullanıcı veya bot sahibi yapabilir.", ephemeral: true });
          }

          const selected = Number(interaction.values[0] || "0");
          const pageIndex = Math.max(0, Math.min(selected, monitor.pages.length - 1));
          // Update monitor message embed
          try {
            await interaction.update({ embeds: [monitor.pages[pageIndex]] });
          } catch {
            await interaction.deferUpdate().catch(() => {});
            try { await monitor.message.edit({ embeds: [monitor.pages[pageIndex]] }).catch(() => {}); } catch {}
          }
        } catch (e) {
          console.error("Calisma select handling error:", e);
          if (client && typeof client.emit === "function")
            client.emit("commandError", { error: e, command: "calisma-select", type: "select", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
          try { await interaction.reply({ content: "Bir hata oluştu.", ephemeral: true }); } catch {}
        }
        return;
      } else if (customId && customId.startsWith("banlist_page_")) {
        try {
          const pages = client._banPages ? client._banPages.get(customId) : null;
          if (!pages || !pages.length) return interaction.reply({ content: "Sayfalar bulunamadı veya süresi dolmuş.", ephemeral: true });
          const selected = Number(interaction.values[0] || "0");
          const pageIndex = Math.max(0, Math.min(selected, pages.length - 1));
          try {
            await interaction.update({ embeds: [pages[pageIndex]] });
          } catch {
            await interaction.deferUpdate().catch(() => {});
            try { await interaction.message.edit({ embeds: [pages[pageIndex]] }).catch(() => {}); } catch {}
          }
        } catch (e) {
          console.error("Banlist select handling error:", e);
          if (client && typeof client.emit === "function") client.emit("commandError", { error: e, command: "banlist-select", type: "select", context: { guildId: interaction.guild?.id, channelId: interaction.channelId, userId: interaction.user.id } });
          try { await interaction.reply({ content: "Bir hata oluştu.", ephemeral: true }); } catch {}
        }
        return;
      }
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (interaction.user.bot) {
        return;
      }

      try {
        const command = client.slashCommands.get(interaction.commandName);
        if (command) {
          if (
            command.ownerOnly &&
            !ayarlar.owners.includes(interaction.user.id)
          ) {
            return interaction.reply({
              content: "Sadece bot sahibi bu komutu kullanabilir.",
              ephemeral: true,
            });
          }

          if (command.cooldown) {
            if (cooldown.has(`${command.name}-${interaction.user.id}`)) {
              const nowDate = interaction.createdTimestamp;
              const waitedDate =
                cooldown.get(`${command.name}-${interaction.user.id}`) -
                nowDate;
              return interaction
                .reply({
                  content: `Cooldown is currently active, please try again <t:${Math.floor(
                    new Date(nowDate + waitedDate).getTime() / 1000,
                  )}:R>.`,
                  ephemeral: true,
                })
                .then(() =>
                  setTimeout(
                    () => interaction.deleteReply(),
                    cooldown.get(`${command.name}-${interaction.user.id}`) -
                      Date.now() +
                      1000,
                  ),
                );
            }

            try {
              await command.slashRun(client, interaction);
            } catch (err) {
              const errPayload = {
                error: err,
                command: command.slashData?.name || command.name || "unknown",
                type: "slash",
                context: {
                  guildId: interaction.guild?.id,
                  channelId: interaction.channelId,
                  userId: interaction.user.id,
                },
              };
              if (client && typeof client.emit === "function")
                client.emit("commandError", errPayload);
              // kullanıcıya kısa bildirim
              interaction
                .reply({
                  content:
                    "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
                  ephemeral: true,
                })
                .catch(() => {});
            }

            cooldown.set(
              `${command.name}-${interaction.user.id}`,
              Date.now() + command.cooldown,
            );

            setTimeout(() => {
              cooldown.delete(`${command.name}-${interaction.user.id}`);
            }, command.cooldown + 1000);
          } else {
            try {
              await command.slashRun(client, interaction);
            } catch (err) {
              const errPayload = {
                error: err,
                command: command.slashData?.name || command.name || "unknown",
                type: "slash",
                context: {
                  guildId: interaction.guild?.id,
                  channelId: interaction.channelId,
                  userId: interaction.user.id,
                },
              };
              if (client && typeof client.emit === "function")
                client.emit("commandError", errPayload);
              interaction
                .reply({
                  content:
                    "Komut çalıştırılırken bir hata oluştu. Bildirim gönderildi.",
                  ephemeral: true,
                })
                .catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error(e);
        interaction.reply({
          content:
            "Bir hata oluştu! Lütfen tekrar deneyin.",
          ephemeral: true,
        });
      }
    }

    // Handle baskin approval buttons
    if (interaction.isButton() && interaction.customId.startsWith('baskin_')) {
      const [action, guildId] = interaction.customId.split('_').slice(1);
      const isOwner = ayarlar.owners.includes(interaction.user.id);
      
      if (!isOwner) {
        return interaction.reply({ content: "Bu işlem için bot sahibi olmalısınız.", ephemeral: true });
      }

      const approvalData = client._baskinApprovalMessages?.get(guildId);
      if (!approvalData) {
        return interaction.reply({ content: "Bu bildirim artık geçerli değil.", ephemeral: true });
      }

      if (action === 'approve') {
        // Save to DB
        const conn = await db.init();
        if (conn && conn.type === "lowdb") {
          await db.saveBaskinLow({ ...approvalData.reportObj, approved: true });
        }

        // Update all messages
        approvalData.messages.forEach(msg => {
          try {
            msg.edit({ content: "✅ Bildirim onaylandı ve kaydedildi.", components: [] }).catch(() => {});
          } catch {}
        });
      } else {
        // Just clear buttons on reject
        approvalData.messages.forEach(msg => {
          try {
            msg.edit({ content: "❌ Bildirim reddedildi.", components: [] }).catch(() => {});
          } catch {}
        });
      }

      client._baskinApprovalMessages.delete(guildId);
      return interaction.reply({ content: action === 'approve' ? "Bildirim onaylandı ve kaydedildi." : "Bildirim reddedildi.", ephemeral: true });
    }
  },
};

/*
  interactionCreate event:
  - ApplicationCommand tipi interaction'lar slash komutlarını temsil eder.
  - Slash komutları client.slashCommands koleksiyonundan alınır.
  - command.ownerOnly === true ise ayarlar.owners dizisinde kontrol edilir.
*/
