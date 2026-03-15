# Preview Environments

> 💡 **Coming Soon (Upcoming Feature)**
> 
> This is a core roadmap feature currently in intense development by the Orbitron engineering team.
> 

Wouldn't it be great if your team members could click a button and test your code directly in the browser before merging it into the main branch (`main` or `master`)?

Whenever you open a new **Pull Request (PR)** in your GitHub repository, the Orbitron system instantly detects it and **spins up an independent, temporary server and a unique access URL exclusively for that PR** within 1 second.

*   QA teams and planners can instantly see the changed UI and provide feedback without having to directly clone the code locally.
*   Once the PR is merged into the main branch or closed, the temporary preview container that was allocated is immediately deleted so as not to waste resources.
