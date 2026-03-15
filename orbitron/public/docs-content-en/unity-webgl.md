# Unity WebGL Optimized Deployment

The WebGL pipeline of the Unity Engine is optimal for deploying lightweight 2D games, 3D web viewers, and mini-casual titles. However, if you simply upload the build results to a cheap ordinary server (Apache/local), the parsing speed crawls so slowly that users will stare at the loading bar and abandon the site.

Orbitron's Unity-dedicated pipeline implements speed-of-light loading by applying specialized Nginx tuning to **forcefully decompress the tightly packed compression files hanging on this WebGL at full speed**.

---

## 🕹 Guide: A Single Setup for Speed-of-Light Loading

To use this feature, **you don't need to touch any code or server settings**, but you must definitively check one single button in your own Unity Editor before coming over.

### Step 1: Editor Build Setup
1. Go to `File` > `Build Settings` at the top of the Unity window.
2. Ensure the target Platform is switched to **[WebGL]**. (If missing, adding the install module from Unity Hub is required)
3. This is the most crucial setting! Click the `Player Settings` button at the bottom right of that window.
4. From the left tab, go to `Player` -> and fully expand the `Publishing Settings` accordion menu in the center.
5. Find the **Compression Format** item. Absolutely do not leave it as `Disabled`—set it to **`Brotli`** or **`Gzip`**!!! (Brotli boasts the highest compression ratio and guarantees the best speeds)
6. Click the `Build` button to extract your output folder.

### Step 2: Verifying Compression Ratio (Why is tuning necessary?)
If you properly configure the settings above and extract the build, you'll see a massive cluster of files with unfamiliar extensions like `.data.br` and `.wasm.br` inside your `Build` folder.
(If you toss these highly compressed files onto a normal server, the Chrome browser will reject them saying "What kind of unheard-of alien format is this?", resulting in a disaster where the game never boots up. Orbitron works its magic by manipulating the headers behind the scenes, ordering the browser: "This is the Brotli compression format, so run it immediately with ultra-fast rendering!")

### Step 3: Uploading
1. **Cleanly compress everything into a `.zip` archive** using ALZip or Bandizip—this includes the final outputs Unity generated: `index.html`, the `Build` folder containing those unfamiliar files, and all contents at the root location where other asset folders reside.
2. Open the **`Unity WebGL Deployment`** tab (not the regular site deployment tab!) on the left side of the Orbitron dashboard, and drag your zip file into the upload window.

The Nginx settings will automatically perfectly tune themselves to match the Brotli or Gzip compression environment you selected, instantly publishing your game hosting at speeds potentially 5x faster than before.
