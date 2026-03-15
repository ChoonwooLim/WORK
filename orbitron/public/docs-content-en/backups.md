# Hybrid Media and System Backups (Backups)

This powerful data preservation snapshot feature prevents catastrophic data loss, such as accidentally deleting valuable user-uploaded profile pictures (e.g., images in the `uploads/` folder) or critical coding files during project operation.

In addition to relational database backups like PostgreSQL, this is used when you need to securely store physical 'files' themselves. Orbitron provides two complete hybrid file archiving solutions, accessible with a single button within the dashboard.

---

## 1. Media System Backup (Media Volume Backup)

A Docker container environment is fundamentally like a sandcastle, where data is volatile (stateless) and disappears every time the code is stopped and restarted. If you don't want to lose user-uploaded photos (in the `media/` folder) from a bulletin board every time the server is shut down, you would have configured persistent storage volumes (`Volumes`) during Orbitron creation.

This feature compresses and stores this valuable mounted folder itself, physically deep within the system, in a secure bunker.

### Backup / Recovery Method
1. Navigate to the project details page in the dashboard and check the **Data Management** panel on the right.
2. **`Media System Backup`** orange button: Clicking this instantly takes a snapshot by compressing the current project's internal media volume folder into a `.tar` archive, stored in a secure local bunker path within the system.
3. This snapshot remains on disk even if the project is completely deleted, allowing for recovery at any time.

---

## 2. Git Project Clone Replication Backup 

What if a GitHub open-source repository you've worked on for days is hacked and completely wiped out or turned private? This is a terrible situation where the server is alive, but the original source code is gone.

Orbitron features a background engine that secretly and deeply backs up the currently linked remote source code repository (GitHub Repo URL) itself within a large mainframe, keeping it updated via separate `git clone` and periodic `git pull` operations. 

### How it Works
1. Click the **`Git Project Clone Replication Backup`** button on the right side of the project screen.
2. Orbitron's internal daemon process fetches the original code you initially linked and creates a perfect copy (Clone) in a hidden directory within the system (e.g., `/home/stevenlim/GitClones/`).
3. If a folder has already been backed up in the past, it intelligently `pull`s only the latest changed logs and merges them, avoiding the redundant act of downloading the entire repository again.
4. This cloned repository, completely physically isolated and separated from the deployment system, serves as your robust defense even if the original is destroyed.