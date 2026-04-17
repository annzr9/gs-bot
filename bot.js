const {
  Client,
  GatewayIntentBits,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');

require('dotenv').config();
const fs = require("fs");

// ================= KEEP ALIVE =================
const http = require("http");
http.createServer((req, res) => {
  res.end("GS Bot Online");
}).listen(process.env.PORT || 3000);

// ================= DATABASE =================
const DB_FILE = "./applications.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= READY =================
client.once(Events.ClientReady, () => {
  console.log(`🚀 Logged in as ${client.user.tag}`);
});

// ================= WELCOME (JOIN) =================
client.on(Events.GuildMemberAdd, async (member) => {

  const channel = member.guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  if (channel) {
    channel.send(`👋 Welcome <@${member.id}>! Please complete /apply to join.`);
  }

  try {
    await member.send("👋 Welcome! You must complete /apply to join the system.");
  } catch (e) {}
});

// ================= APPLY COMMAND =================
client.on(Events.InteractionCreate, async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "apply") {

    const modal = new ModalBuilder()
      .setCustomId("apply_form")
      .setTitle("GS Application Form");

    const name = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Full Name")
      .setStyle(TextInputStyle.Short);

    const email = new TextInputBuilder()
      .setCustomId("email")
      .setLabel("Email")
      .setStyle(TextInputStyle.Short);

    const id = new TextInputBuilder()
      .setCustomId("id")
      .setLabel("University ID")
      .setStyle(TextInputStyle.Short);

    const batch = new TextInputBuilder()
      .setCustomId("batch")
      .setLabel("Batch / Year")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(name),
      new ActionRowBuilder().addComponents(email),
      new ActionRowBuilder().addComponents(id),
      new ActionRowBuilder().addComponents(batch)
    );

    return interaction.showModal(modal);
  }
});

// ================= FORM SUBMIT =================
client.on(Events.InteractionCreate, async (interaction) => {

  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== "apply_form") return;

  const db = loadDB();

  if (db.find(x => x.userId === interaction.user.id)) {
    return interaction.reply({
      content: "❌ You already applied.",
      ephemeral: true
    });
  }

  const name = interaction.fields.getTextInputValue("name");
  const email = interaction.fields.getTextInputValue("email");
  const id = interaction.fields.getTextInputValue("id");
  const batch = interaction.fields.getTextInputValue("batch");

  const newApp = {
    userId: interaction.user.id,
    name,
    email,
    universityId: id,
    batch,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  db.push(newApp);
  saveDB(db);

  const channel = interaction.guild.channels.cache.find(c =>
    c.name.includes("applications")
  );

  if (!channel) {
    return interaction.reply({
      content: "❌ Applications channel not found",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📥 New Application")
    .setColor("Yellow")
    .addFields(
      { name: "Name", value: name },
      { name: "Email", value: email },
      { name: "ID", value: id },
      { name: "Batch", value: batch },
      { name: "User", value: `<@${interaction.user.id}>` },
      { name: "Status", value: "PENDING ⏳" }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${interaction.user.id}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`reject_${interaction.user.id}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });

  return interaction.reply({
    content: "✅ Application submitted successfully",
    ephemeral: true
  });
});

// ================= ACCEPT / REJECT =================
client.on(Events.InteractionCreate, async (interaction) => {

  if (!interaction.isButton()) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "Admin only", ephemeral: true });
  }

  const db = loadDB();
  const userId = interaction.customId.split("_")[1];

  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  // ================= ACCEPT =================
  if (interaction.customId.startsWith("accept_")) {

    const app = db.find(x => x.userId === userId);
    if (app) app.status = "ACCEPTED";
    saveDB(db);

    const role = interaction.guild.roles.cache.find(r => r.name === "MEMBER");
    if (role && member) await member.roles.add(role);

    // ================= CHANGE NICKNAME =================
    if (member && app) {
      try {
        await member.setNickname(app.name);
      } catch (err) {
        console.log("Nickname error:", err.message);
      }
    }

    // ================= WELCOME CHANNEL MESSAGE =================
    const welcomeChannel = interaction.guild.channels.cache.find(c =>
      c.name.includes("welcome")
    );

    if (welcomeChannel && app) {
      welcomeChannel.send(
        `🎉 Welcome ${app.name} | Eng. 🚀`
      );
    }

    if (member) {
      await member.send("🎉 Your application has been ACCEPTED!");
    }

    return interaction.reply({
      content: `✅ Accepted <@${userId}>`,
      ephemeral: true
    });
  }

  // ================= REJECT =================
  if (interaction.customId.startsWith("reject_")) {

    const app = db.find(x => x.userId === userId);
    if (app) app.status = "REJECTED";
    saveDB(db);

    if (member) {
      await member.send("❌ Your application has been REJECTED.");
    }

    return interaction.reply({
      content: `❌ Rejected <@${userId}>`,
      ephemeral: true
    });
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
