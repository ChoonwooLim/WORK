# Hybrid Media and System Backups

This is a powerful data preservation snapshot feature designed to prevent catastrophic events where precious profile pictures uploaded by users (images in the `uploads/` folder, etc.) or core coding files are accidentally deleted during project operation.

Beyond backing up relational databases like PostgreSQL, this is used when you need to securely store physical 'files' themselves. Orbitron provides two complete hybrid file archiving solutions within the dashboard with just a single button click.

---

## 1. Media System Backup (Media Volume Backup)

The inside of a Docker container is essentially a sandcastle environment where data is volatile (Stateless) every time you restart the code. If you don't want to lose the photos users uploaded to a message board (the `media/` folder) every time the server shuts down, you would have configured a permanent storage volume (`Volumes`) when creating Orbitron.

This feature physically compresses and stores this precious mounted folder entirely into a secure local bunker deep within the system.

### How to Backup / Restore
1. Enter the project details page on the dashboard and check the **Data Management** panel on the right.
2. **`Media System Backup`** orange button: The moment you click it, the entire media volume folder inside your current project is `.tar` archived, compressed, and snapshotted directly to the secure local bunker path on the system.
3. Even if the project is completely deleted, this snapshot remains on the disk and can be restored at any time.

---

## 2. Git Project Clone Replication Backup

What if the open-source GitHub repository you spent days writing is hacked by someone and completely vanishes, or is turned private? It's a nightmare scenario where the server is alive but the original source code is gone.

Orbitron comes equipped with a background engine that secretly and deeply backs up the actually linked remote source code repository (GitHub Repo URL) into the massive mainframe via separate `git clone` and periodic `git pull` updates.

### How it Works
1. Click the **`Git Project Clone Replication Backup`** button on the right screen of your project.
2. Orbitron's internal daemon process fetches the original code you first linked and creates a perfect `Clone` in a hidden directory on the system (like `/home/stevenlim/GitClones/`).
3. If there is already a folder backed up in the past, it brilliantly avoids doing the foolish act of downloading everything again, instead smartly `pull`ing and `Merge`ing only the latest modified logs.
4. This copied repository, completely physically blocked and isolated from the deployment system, serves as your robust shield even if the original is destroyed.