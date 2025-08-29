# Küçük El Kitapçığı (discord.js v14 - Bu proje)

Özet:
- Komut modülleri `src/Commands/<kategori>/<komut>.js` içinde `module.exports.commandBase` objesi ile tanımlanır.
- Event dosyaları `src/Events` içinde `{ name, once?, execute }` formatındadır.
- Handler'lar `src/Handlers` içinde yüklenir ve client üzerinde koleksiyonlar oluşturur:
  - client.commands (prefix)
  - client.commandAliases
  - client.slashCommands
  - client.slashDatas (REST ile register için)

Komut şablonu (örnek):
```javascript
// minimal template (module.exports.commandBase ile)
module.exports.commandBase = {
  prefixData: { name: "isim", aliases: ["a"] }, // prefix komutu için
  slashData: new SlashCommandBuilder().setName("isim").setDescription("..."), // slash
  cooldown: 5000,
  ownerOnly: false,
  conf: {
    description: "Kısa açıklama",
    usage: "!isim <arg>",
    examples: ["!isim arg", "/isim arg"]
  },
  async prefixRun(client, message, args) { /* prefix davranışı */ },
  async slashRun(client, interaction) { /* slash davranışı */ },
};
```

İpuçları:
- `MessageContent` intent'i message.content okumak için gereklidir. Botunuz Developer Portal'da bu intent'e sahip olmalı.
- Büyük Discord ID'lerini string olarak saklayın (`"7822..."`) — JS number overflow riski.
- Slash komutlarını register ederken geliştirme için guild-specific registration (faster) kullanabilirsiniz:
  - REST.put(Routes.applicationGuildCommands(appId, guildId), { body: [...] })

Nasıl başlatılır:
1. .env içinde BOT_TOKEN doğru olsun.
2. npm install
3. node src/Base/bot.js (veya npm start)
