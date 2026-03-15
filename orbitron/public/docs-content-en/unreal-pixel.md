# Unreal Engine Pixel Streaming

How do you share heavy 3D high-quality games, immersive Metaverses, or photorealistic architectural simulation models that are tens of gigabytes (GB) in size with others? You can't expect the other person to buy a high-performance computer or wait all day for a download.

Orbitron's **Unreal Pixel Streaming** feature runs your game on a high-spec cloud GPU, then converts its screen into a video stream, much like Netflix or YouTube, and transmits it to you. The other person simply needs to **click a dedicated link in their web browser** to immediately control and enjoy a real-time demonstration without any installation. (It works even if the PC motherboard has no graphics card at all.)

---

## 🎮 Packaging and Upload Guide (For Beginners)

This is the essential preparation process for uploading your high-quality project, diligently created in Unreal Engine 5 (UE5), to the Orbitron system.

### Step 1: Plugin Activation
1. Launch the Unreal Engine editor.
2. Open the Plugins window from the top menu: Edit > Plugins.
3. Search for and check (enable) the crucial **Pixel Streaming plugin**. If prompted to restart the editor, please do so.

### Step 2: Packaging for Linux Server (IMPORTANT!!!)
Orbitron operates on a Linux OS for cost savings and server stability. Therefore, you must generate a **Linux-specific build**, not a Windows one.

1. Click the `Platforms` menu in the corner of the top toolbar.
2. The target platform must be set to **[Linux]**. (If it's not an option, you need to modify the engine installation options in the Epic Games Launcher to add 'Linux' target support.)
3. For the build configuration, choose `Shipping` or `Development` according to your optimization preference; lighter is generally better.
4. Click Package Project to create the output folder on your desktop or similar location.

### Step 3: Compress and Upload
1. Navigate into the successfully built folder that was just outputted to your computer. (The folder named `Linux` or `LinuxServer`)
2. Select all contents within the folder, right-click, and **compress them into a single `.zip` file using Alzip or Bandizip**.
3. Now, open the Orbitron dashboard and click the **`Unreal Engine Deployment`** button in the dedicated left-hand menu to open the upload window.
4. Drag and drop the compressed zip file into the window and click the upload button! (Upload may take more than 5 minutes for large files.)

---

## 🛠 Orbitron Dual GPU Smart Allocation System

Unreal Engine rendering consumes immense graphical resources (GPU). Orbitron features advanced special algorithms, superior to expensive AWS solutions on the market.

> 💡 **Smart Load Balancing**
> When multiple viewers (users) simultaneously access a streaming link for a single game model, the system forcibly allocates and distributes (smart routing) user viewpoints to idle auxiliary graphics cards, creating a comfortable distributed rendering environment. This is a core engine that prevents game frames from stuttering and servers from crashing due to a surge in users.