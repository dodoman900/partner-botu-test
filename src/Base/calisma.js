const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

async function start(client, channelId) {
  if (!client || !channelId) throw new Error("client and channelId required");

  // ensure map container
  if (!client._calismaMonitors) client._calismaMonitors = new Map();
  const monitorKey = String(channelId);

  // memory rolling samples
  if (!client._memSamples) client._memSamples = [];

  // helper to build pages
  function buildPages() {
    const mem = process.memoryUsage();
    const rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
    client._memSamples.push(rssMb);
    if (client._memSamples.length > 20) client._memSamples.shift();
    const avgMem = (client._memSamples.reduce((a,b) => a+b,0) / client._memSamples.length).toFixed(2);

    const uptimeSec = Math.floor(process.uptime());
    const uptimeStr = new Date(uptimeSec * 1000).toISOString().substr(11,8);

    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    const lastError = client._lastError ? `${new Date(client._lastError.at).toLocaleString()}\n${client._lastError.payload.command || ""}\n${String(client._lastError.payload.error?.message || "").slice(0,200)}` : "Yok";

    const page0 = new EmbedBuilder()
      .setTitle("Bot Durum / İstatistikler")
      .addFields(
        { name: "Çalışma süresi", value: uptimeStr, inline: true },
        { name: "Sunucu sayısı", value: String(guildCount), inline: true },
        { name: "Tahmini kullanıcı", value: String(userCount), inline: true },
        { name: "Anlık RAM (MB)", value: String(rssMb), inline: true },
        { name: "Ortalama RAM (MB)", value: String(avgMem), inline: true },
        { name: "Son hata", value: lastError.length ? lastError : "Yok", inline: false },
      )
      .setTimestamp();

    const page1 = new EmbedBuilder()
      .setTitle("Örnek Hata Listesi (son)")
      .setDescription(client._lastError ? `${client._lastError.payload.command} — ${String(client._lastError.payload.error?.message || "").slice(0,400)}` : "Hata bulunamadı")
      .setTimestamp();

    const page2 = new EmbedBuilder()
      .setTitle("Komut İstatistikleri (örnek)")
      .setDescription("Prefix komut sayısı: " + (client.commands?.size || 0) + "\nSlash komut sayısı: " + (client.slashCommands?.size || 0))
      .setTimestamp();

    return [page0, page1, page2];
  }

  // create or fetch channel
  let ch;
  try {
    ch = await client.channels.fetch(channelId).catch(() => null);
  } catch { ch = null; }
  if (!ch || !ch.isTextBased?.()) throw new Error("Log kanalı bulunamadı veya yazılamıyor.");

  // build initial
  const pages = buildPages();
  const selectOptions = pages.map((p, idx) => ({
    label: `Sayfa ${idx+1}`,
    description: p.title?.slice(0,50) || `Sayfa ${idx+1}`,
    value: String(idx),
  })).slice(0,25);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`calisma_select_${monitorKey}`)
    .setPlaceholder("Gösterim seçin")
    .addOptions(selectOptions);

  const row = new ActionRowBuilder().addComponents(select);

  // send or edit existing monitor message
  let sentMsg = null;
  try {
    sentMsg = await ch.send({ embeds: [pages[0]], components: [row] });
  } catch (e) {
    throw new Error("Monitor mesajı gönderilemedi: " + (e.message || e));
  }

  // store monitor
  client._calismaMonitors.set(monitorKey, { message: sentMsg, pages, ownerId: (client.application?.owner?.id) || null });

  // periodic updater
  const interval = setInterval(async () => {
    try {
      const newPages = buildPages();
      const monitor = client._calismaMonitors.get(monitorKey);
      if (!monitor) return clearInterval(interval);
      monitor.pages = newPages;
      // update message embed if possible (keep components)
      try {
        await monitor.message.edit({ embeds: [newPages[0]] }).catch(() => {});
      } catch {}
    } catch {}
  }, 30_000);

  // cleanup on client destroy
  client.once("destroy", () => {
    clearInterval(interval);
    client._calismaMonitors.delete(monitorKey);
  });

  return { channel: ch, message: sentMsg };
}

module.exports = { start };
