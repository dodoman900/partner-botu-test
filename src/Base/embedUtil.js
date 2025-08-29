function applyFooter(embed, client) {
  if (!embed || !client) return embed;
  try {
    const year = new Date().getFullYear();
    embed.setFooter({ text: `${client.user.username} • ${year}`, iconURL: client.user.displayAvatarURL?.() || null });
  } catch {}
  return embed;
}

module.exports = { applyFooter };
