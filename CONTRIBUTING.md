# Contributing & Submitting Issues 🚀

English | [Русский](CONTRIBUTING.ru.md)

First of all, **thank you!** ❤️ Thank you for taking the time to contribute and help make Dynamic Tiler better. Community feedback, bug reports, and structural suggestions are what keep this project stable, high-performance, and delightful to use. 

Whether you found a visual glitch, a layout edge-case collision, or have an idea to make keyboard tiling even smoother, your contribution is highly valued.

---

## 🔍 How to Submit a High-Quality Issue

To help us diagnose and fix your issue as quickly as possible, please ensure your bug report contains the following crucial elements:

### 1. 🔁 A Reproducible Case
A bug is only fixable if it can be consistently reproduced. 
* Describe the **starting state**: How many windows are open? What are their approximate positions or grid coordinates? (e.g., "Two windows tiled side-by-side on a horizontal 12x6 grid").
* List the **exact sequence of actions** (mouse drags, modifiers held, hotkeys pressed) that trigger the problem.
* Describe the **Expected Behavior** (what you thought should happen) versus the **Actual Behavior** (what actually happened).

### 2. 📝 Full Text Description of Actions
While screenshots and screen recordings (GIFs/MP4s) are excellent visual aids (and highly encouraged!), **they cannot replace written text**. 
* Text is searchable, indexable, and can be easily parsed by maintainers and debuggers.
* Please write out all steps in detail. Don't just attach a video and say "it broke here".

### 3. 🪵 Enable Diagnostics & Copy Debug Logs
Dynamic Tiler has a dedicated sub-millisecond logging engine that traces solver decisions, coordinate maps, and layout transactions.
To capture logs:
1. Open **Cinnamon Extensions**, select **Dynamic Tiler**, and click **Configure** (the gear icon).
2. Navigate to the **Diagnostics** tab.
3. Toggle **Debugging** (Enable debug logs) **ON**.
4. Open a terminal and run the following command to monitor logs in real-time, or reproduce the issue and grab the relevant log window:
   ```bash
   # Dynamic Tiler logs directly to ~/.xsession-errors
   tail -f ~/.xsession-errors | grep -i "dynamic-tiler"
   ```
5. Copy the logs generated during the bug event and paste them into your issue description wrapped in a markdown code block:
   \```text
   [dynamic-tiler] [DND Trace] ...
   \```

### 4. 💻 Describe Your Environment
Desktop environments, window managers, display servers, and multi-monitor configurations vary widely. Knowing your exact setup is critical to isolating OS-specific bugs.

---

## 🛠️ Automated Environment Report Command

To make reporting your environment as easy as possible, we have assembled a convenient, ready-to-use bash command. It queries standard Linux utilities to gather all required system information, formatted neatly in Markdown.

Copy and run this command in your terminal:

```bash
echo -e "### Environment Information\n\n- **OS / Distro:** $(grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2- | tr -d '\"' || echo 'Unknown')\n- **Cinnamon Version:** $(cinnamon --version 2>/dev/null || echo 'Unknown')\n- **Kernel:** $(uname -s -r -m)\n- **Session Type:** ${XDG_SESSION_TYPE:-Unknown} (DISPLAY: ${DISPLAY:-None})\n- **Window Manager:** $(wmctrl -m 2>/dev/null | grep 'Name:' | awk '{print $2}' || echo 'Muffin/Cinnamon')\n- **Node.js:** $(node -v 2>/dev/null || echo 'Not installed')\n- **npm:** $(npm -v 2>/dev/null || echo 'Not installed')\n- **Display Setup (xrandr):**\n\`\`\`text\n$(xrandr --listmonitors 2>/dev/null | tail -n +2 || echo 'xrandr not available')\n\`\`\`"
```

### Example Output:
Simply copy the output of that command and paste it directly into your issue!

```markdown
### Environment Information

- **OS / Distro:** Linux Mint 21.3 Virginia
- **Cinnamon Version:** Cinnamon 6.0.4
- **Kernel:** Linux 6.5.0-21-generic x86_64
- **Session Type:** x11 (DISPLAY: :0)
- **Window Manager:** Muffin
- **Node.js:** v20.11.0
- **npm:** 10.2.4
- **Display Setup (xrandr):**
```text
 0: +*HDMI-1 1920/509x1080/286+0+0  HDMI-1
 1: +DP-1 1920/509x1080/286+1920+0  DP-1
```
```

---

## 💡 Proposing Feature Requests & Enhancements

If you are suggesting a new feature, grid algorithm, or workflow gesture, we want to hear it! Please frame your suggestion by describing:
* **The Problem:** What limitation or frustration are you trying to overcome?
* **The Proposed Solution:** How should the new feature work? (Include hotkeys, modifiers, or dragging diagrams if applicable).
* **The Use Case:** Why is this beneficial to daily workflows?

---

Thank you again for helping us push the boundaries of desktop layout efficiency. Your effort makes our desks cleaner and our workflows faster! 🌟
