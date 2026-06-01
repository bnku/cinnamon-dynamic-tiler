---
name: 🐛 Bug Report (English)
about: Report a reproducible layout collision or error in Dynamic Tiler
title: "[BUG] "
labels: bug
assignees: ''
---

<!-- 
IMPORTANT: Contributions to this repository should follow our Contributing Guidelines.
Please read: https://github.com/bnku/cinnamon-dynamic-tiler/blob/master/CONTRIBUTING.md
-->

**1. Reproducible Case / Steps to Reproduce**
*Describe your window layout starting state (e.g., "Horizontal grid 12x6, two terminal windows tiled side-by-side...") and the actions taken:*
1. 
2. 
3. 

**2. Expected Behavior**
*Describe what you expected to happen.*

**3. Actual Behavior**
*Describe what actually happened.*

**4. Environment Information**
*Please run the following command in your terminal and paste the output below to describe your system environment:*
```bash
echo -e "- **OS / Distro:** $(grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2- | tr -d '\"' || echo 'Unknown')\n- **Cinnamon Version:** $(cinnamon --version 2>/dev/null || echo 'Unknown')\n- **Kernel:** $(uname -s -r -m)\n- **Session Type:** ${XDG_SESSION_TYPE:-Unknown} (DISPLAY: ${DISPLAY:-None})\n- **Window Manager:** $(wmctrl -m 2>/dev/null | grep 'Name:' | awk '{print $2}' || echo 'Muffin/Cinnamon')\n- **Node.js:** $(node -v 2>/dev/null || echo 'Not installed')\n- **npm:** $(npm -v 2>/dev/null || echo 'Not installed')"
```

*PASTE REPORT OUTPUT HERE:*
- **OS / Distro:** 
- **Cinnamon Version:** 
- **Kernel:** 
- **Session Type:** 
- **Window Manager:** 
- **Node.js:** 
- **npm:** 

**5. Diagnostics & Debug Logs**
*Toggle 'Debugging' ON in the extension Settings (Diagnostics tab), reproduce the bug, copy the relevant logs from `~/.xsession-errors` (you can filter using `grep "dynamic-tiler"`), and paste them below:*
```text
PASTE LOGS HERE
```
