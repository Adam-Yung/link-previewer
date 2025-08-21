# Link Previewer ✨

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/Adam-Yung/link-previewer.git)
[![Version](https://img.shields.io/badge/version-2.1.0-blue)](https://github.com/Adam-Yung/link-previewer.git)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL3.0-yellow.svg)](https://opensource.org/licenses/GPL)

📢 Stop opening new tabs for search results‼️ </br></br>
**Link Previewer** lets you peek into web pages without ever leaving your current tab.

> [!IMPORTANT]
> Say Goodbye To Hopping *Back* and *Forward* on search pages!

> [!NOTE]
> Two Guarantees:
> 1. Always Open Source
> 2. No Useless **"AI Summary"** will ever be added to a simple Browser Utility
</br>

## ✨ Get the Extension
<a href="https://chrome.google.com/webstore/detail/hghkdmkjjfooodjaefodopbnhejdaonh" target="_blank"><img src="https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png" alt="Get it on the Chrome Web Store" height="58"></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/link-previewer-firefox/" target="_blank"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="Get the Add-on for Firefox" height="58"></a>

</br>

## 😁 Demo
<img src="Common/icons/firefox-demo.gif" alt="Link Previewer in Action" width="700" height="400">
</br>

## 🚀 Key Features

* **Seamless Previews with Sleek UI**: Open links in a sleek, floating pop-up window that looks like it is built into the browser.
* **Cross-Browser Support**: Supports both **Google Chrome** and **Mozilla Firefox** with `Manifest V2` and `Manifest V3` support.
* **Open Source and Never Integrated With AI**: This project is Open Source, and I personally promise I'll never add any useless AI crap to the preview window.  If I do, you can fork my repo any time 😜
* **Pocket Mode and Center Stage**: *Drag* and *Resize* preview window to fit your needs.  Toggle the **Restore button** to switch between Pocket and Center Stage modes.
* **Extensively Customizable**: Configure the long-press duration, modifier keys, default window size, and **site-specific toggling**
* **Light & Dark Modes**: A beautiful interface that adapts to your system's theme or your personal preference.


## 💡 How to Use

* **Start Previewing**:
  * **Long-press** a link to open a preview.
  * **Modifier Key + Click** (e.g., `Shift + Click`) for an instant preview.

The preview window can be moved by dragging its header and resized by dragging its edges. To close it, either click the 'x' button, press your configured close key (`Escape` by default), or click anywhere outside the window.

### ⚙️ Customization

Toggle light/dark mode, set click duration and more! Click the Link Previewer icon in your browser's toolbar to open the settings panel.
</br>
<img src="Common/icons/settings.gif" alt="Link Previewer Settings" height="400">
</br>

## ✅ Compatibility

Works with Manifest V3 and Chrome!
</br>
<img src="Common/icons/chrome-demo.gif" alt="Link Previewer in Chrome" width="700" height="400">
</br>

### ⚠️ A Note for Firefox Users

Firefox's **Enhanced Tracking Protection** is cool, but it might break Link Previewer due to CORS-related limitations.

> [!TIP]
> If you find that previews are not appearing, or for sites that frequently need previewing (like `www.google.com`) try turning off this protection **for that specific site only**. You can do this by clicking the **shield icon** to the left of the address bar and toggling the switch.

</br>

## 🛠️ Building From Source

> [!NOTE]
> Contributions are very welcomed!!!

### Prerequisites

* POSIX-compliant system
  * The [build script](build/build.sh) is written in BASH, though it is not hard to adapt the script for Windows
* [Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/installing-git-large-file-storage)
  * Git LFS is used to store the large .gif files more efficiently
* [Node.js](https://nodejs.org/) (which includes npm)
  * *only if you want to run npm build wrapper around `build/build.sh`*

### Steps

1. **Clone the Repository**

    ```bash
    git clone "https://github.com/Adam-Yung/link-previewer.git"
    cd link-previewer
    ```

2. **Build the Extension**
    You can build for Chrome or Firefox using the following npm scripts:

    * **For Google Chrome:**

        ```bash
        npm run build chrome # Or equivalently ./build/build.sh chrome
        ```

    * **For Mozilla Firefox:**

        ```bash
        npm run build firefox # Or equivalently ./build/build.sh firefox
        ```

    After running a build command, the complete, unpacked extension will be available in the `out/` directory.

3. **Load the Extension in Your Browser**

    * **Chrome:**
        1. Navigate to `chrome://extensions`.
        2. Enable "Developer mode" (toggle in the top right).
        3. Click "Load unpacked".
        4. Select the `out/dist` folder from this project.

    * **Firefox:**
        1. Navigate to `about:debugging`.
        2. Click "This Firefox" in the sidebar.
        3. Click "Load Temporary Add-on...".
        4. Open the `out` folder and select the `link-previewer-firefox-[Version].zip` file.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Adam-Yung/link-previewer/issues).

## 📜 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.