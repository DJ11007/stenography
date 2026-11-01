# Deploying sctyping.com

sctyping.com runs on our own Ubuntu server (nginx in front, the Next.js app behind it). A deploy takes the latest code
from GitHub (`main`), builds it on the server and restarts the app. It takes a few minutes.

**Golden rule: never deploy while a live exam is running.** Deploy before an exam starts or after it ends. A deploy in
the middle of an exam can break the students' open exam pages.

---

## Part 1 — One-time setup (for the person who has the server login)

This connects GitHub to the server once, so the "Deploy" button can log in by itself. Nobody else needs the server
password after this.

1. **Log in to the server** as usual and note:
   - the project folder, for example `/var/www/stenography` → this is `APP_DIR`
   - how the app is restarted, for example `pm2 restart stenography` or `sudo systemctl restart stenography`
     → this is `RESTART_CMD` (if it needs `sudo`, allow that one command without a password for the deploy user)
2. **Make a deploy key** (a login key used only by GitHub), on the server:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-deploy"
   ```
   ```bash
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
   ```
   The private key is `~/.ssh/github_deploy` (shown with `cat ~/.ssh/github_deploy`) → this is `SSH_KEY`.
3. **Get the server's fingerprint**, from any computer:
   ```bash
   ssh-keyscan -p 22 <server address>
   ```
   The whole output → this is `SSH_KNOWN_HOSTS`.
4. **Check once by hand** that the script works on the server (from the project folder):
   ```bash
   RESTART_CMD="pm2 restart stenography" bash scripts/deploy.sh
   ```
   (use your real restart command). It should end with `== Done`.
5. **Add the secrets on GitHub**: the repository → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**, one for each:

   | Name | Value |
   |---|---|
   | `SSH_HOST` | the server's address (IP or name) |
   | `SSH_USER` | the user you log in with |
   | `SSH_PORT` | `22` (or your SSH port) |
   | `SSH_KEY` | the private key from step 2 (all of it, including the BEGIN/END lines) |
   | `SSH_KNOWN_HOSTS` | the output of step 3 |
   | `APP_DIR` | the project folder from step 1 |
   | `RESTART_CMD` | the restart command from step 1 |

6. **Give the admin access**: Settings → Collaborators → add the admin's GitHub account (Write access), so they can
   press the button.

Secrets are hidden after saving: nobody (not even the admin) can read them back, and they never appear in the logs.

---

## Part 2 — Deploying (every time, for the admin)

1. Make sure **no live exam is running now**.
2. Open the repository on GitHub → tab **Actions**.
3. On the left, click **Deploy sctyping.com**.
4. On the right, click **Run workflow** → in the box type `DEPLOY` (capital letters) → green **Run workflow**.
5. A new run appears. Click it to watch. In about 3–6 minutes it shows a **green tick** = the site is updated.
   A **red cross** = it did not deploy; the running site is unchanged. Open the run to read the last lines and send
   them to whoever helps you.
6. Students who already had the site open should refresh the page.

That is all: no terminal, no password. It works from a phone too.
