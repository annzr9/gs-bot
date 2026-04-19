// bot.js
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
  PermissionsBitField,
  ChannelType
} = require("discord.js");

require("dotenv").config();
const fs = require("fs");
const http = require("http");

// ================= ERROR PROTECTION =================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= KEEP ALIVE =================
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("MMEC Bot Online");
}).listen(process.env.PORT || 3000);

// ================= DATABASE =================
const DB_FILE = "./applications.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return [];
  }
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

// ================= CHANNEL SETUP =================
async function ensureChannel(guild, name, topic = "") {
  let channel = guild.channels.cache.find(c => c.name === name);

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      topic
    });
  }

  return channel;
}

async function setupServer(guild) {
  await ensureChannel(guild, "📥・applications", "Applications");
  await ensureChannel(guild, "👋・welcome", "Welcome");
  await ensureChannel(guild, "📜・rules", "Server Rules");
  await ensureChannel(guild, "📢・announcements", "Official Announcements");
  await ensureChannel(guild, "🔗・links", "Club Links");
}

// ================= APPLY PANEL =================
async function sendApplyPanel(guild) {
  const channel = guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Welcome to MMEC Club")
    .setDescription(
      "To become an official member, click the button below and complete your application."
    )
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_apply")
      .setLabel("Apply Now")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  }).catch(() => {});
}

// ================= READY =================
client.once(Events.ClientReady, async () => {
  console.log(`🚀 Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await setupServer(guild);
    await sendApplyPanel(guild);
  }
});

// ================= JOIN MEMBER =================
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  if (channel) {
    await channel.send(`👋 Welcome <@${member.id}>`);
  }

  try {
    await member.send(
      "👋 Welcome to MMEC Club!\nGo to #welcome and click Apply Now."
    );
  } catch {}
});

// ================= OPEN MODAL =================
async function openApplyModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("apply_form")
    .setTitle("MMEC Application Form");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Full Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("Email")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const id = new TextInputBuilder()
    .setCustomId("id")
    .setLabel("University ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const batch = new TextInputBuilder()
    .setCustomId("batch")
    .setLabel("Batch / Year")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(id),
    new ActionRowBuilder().addComponents(batch)
  );

  await interaction.showModal(modal);
}

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async (interaction) => {
  try {

    // ===== Slash Commands =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "apply") {
        return openApplyModal(interaction);
      }

      if (interaction.commandName === "setup") {

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({
            content: "Admin only.",
            ephemeral: true
          });
        }

        await setupServer(interaction.guild);

        return interaction.reply({
          content: "✅ Server setup completed.",
          ephemeral: true
        });
      }
    }

    // ===== Buttons =====
    if (interaction.isButton()) {

      // Apply button
      if (interaction.customId === "open_apply") {
        return openApplyModal(interaction);
      }

      // Accept / Reject
      if (
        interaction.customId.startsWith("accept_") ||
        interaction.customId.startsWith("reject_")
      ) {

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({
            content: "Admin only.",
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const db = loadDB();
        const userId = interaction.customId.split("_")[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const app = db.find(x => x.userId === userId);

        if (!app) {
          return interaction.editReply("Application not found.");
        }

        // ACCEPT
        if (interaction.customId.startsWith("accept_")) {

          app.status = "ACCEPTED";
          saveDB(db);

          let role = interaction.guild.roles.cache.find(r => r.name === "MEMBER");
          if (role && member) await member.roles.add(role).catch(() => {});

          if (member) {
            await member.setNickname(app.name).catch(() => {});
            await member.send("🎉 Your application has been ACCEPTED!").catch(() => {});
          }

          const welcomeChannel = interaction.guild.channels.cache.find(c =>
            c.name.includes("welcome")
          );

          if (welcomeChannel) {
            await welcomeChannel.send(`🎉 Welcome ${app.name} | Eng. 🚀`);
          }

          return interaction.editReply(`✅ Accepted <@${userId}>`);
        }

        // REJECT
        if (interaction.customId.startsWith("reject_")) {

          app.status = "REJECTED";
          saveDB(db);

          if (member) {
            await member.send("❌ Your application has been REJECTED.").catch(() => {});
          }

          return interaction.editReply(`❌ Rejected <@${userId}>`);
        }
      }
    }

    // ===== Modal Submit =====
    if (interaction.isModalSubmit()) {

      if (interaction.customId !== "apply_form") return;

      await interaction.deferReply({ ephemeral: true });

      const db = loadDB();

      if (db.find(x => x.userId === interaction.user.id)) {
        return interaction.editReply("❌ You already applied.");
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
        return interaction.editReply("❌ Applications channel not found.");
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

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.editReply("✅ Application submitted successfully.");
    }

  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Unexpected error.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN)
  .then(() => console.log("✅ Discord Connected"))
  .catch(err => console.error("❌ Login Error:", err));
