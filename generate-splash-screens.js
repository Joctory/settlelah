const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");

// Configuration for splash screens
const splashScreens = [
  { width: 640, height: 1136, name: "splash-640x1136.png" }, // iPhone 5, SE (1st gen)
  { width: 750, height: 1334, name: "splash-750x1334.png" }, // iPhone 6, 7, 8
  { width: 1242, height: 2208, name: "splash-1242x2208.png" }, // iPhone 6+, 7+, 8+
  { width: 1125, height: 2436, name: "splash-1125x2436.png" }, // iPhone X, XS
  { width: 1536, height: 2048, name: "splash-1536x2048.png" }, // iPad Mini, iPad Air
  { width: 1668, height: 2224, name: "splash-1668x2224.png" }, // iPad Pro 10.5"
  { width: 2048, height: 2732, name: "splash-2048x2732.png" }, // iPad Pro 12.9"
];

// Directory where icons are located and splash screens will be saved
const iconsDir = path.join(__dirname, "public", "icons");

// Background color for splash screens
const backgroundColor = "#000000";
// Text color for splash screens
const textColor = "#ffffff";

async function generateSplashScreens() {
  try {
    // Check if icons directory exists
    if (!fs.existsSync(iconsDir)) {
      console.error(`Icons directory not found: ${iconsDir}`);
      return;
    }

    // Load the largest icon as the logo
    const iconPath = path.join(iconsDir, "icon-512x512.png");
    if (!fs.existsSync(iconPath)) {
      console.error(`Icon file not found: ${iconPath}`);
      return;
    }

    const icon = await loadImage(iconPath);

    // Create each splash screen
    for (const screen of splashScreens) {
      const canvas = createCanvas(screen.width, screen.height);
      const ctx = canvas.getContext("2d");

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, screen.width, screen.height);

      // Calculate icon size (50% of the smallest dimension)
      const iconSize = Math.min(screen.width, screen.height) * 0.5;

      // Draw icon in the center
      ctx.drawImage(icon, (screen.width - iconSize) / 2, (screen.height - iconSize) / 2, iconSize, iconSize);

      // Add app name below the icon
      ctx.fillStyle = textColor;
      ctx.font = `bold ${Math.floor(iconSize * 0.15)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("SettleLah!", screen.width / 2, (screen.height + iconSize) / 2 + Math.floor(iconSize * 0.2));

      // Save the splash screen
      const outputPath = path.join(iconsDir, screen.name);
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(outputPath, buffer);
      console.log(`Generated ${screen.name}`);
    }

    console.log("All splash screens generated successfully!");
  } catch (err) {
    console.error("Error generating splash screens:", err);
  }
}

generateSplashScreens();
