const db = require('/home/stevenlim/WORK/orbitron/db/db');
const deployer = require('/home/stevenlim/WORK/orbitron/services/deployer');

(async () => {
    try {
        console.log('Inserting mock project...');
        const project = await db.queryOne(
            `INSERT INTO projects (
                user_id, name, github_url, branch, build_command, start_command, 
                port, subdomain, env_vars, auto_deploy, source_type, ai_model, type
            ) VALUES (1, 'yaml-test-app-4', '/tmp/orbitron-yaml-git', 'master', 'npm install', 'npm start', 3000, 'yaml-test-app-4', '{}', false, 'github', 'claude-3-haiku', 'web') RETURNING *`
        );

        console.log('Starting deployment...', project.id);

        // Listen to progress to print it out
        deployer.on('progress', (data) => {
            if (data.projectId === project.id) {
                console.log(`[PROGRESS] ${data.step}: ${data.message}`);
            }
        });

        await deployer.deploy(project);

        const updatedProject = await db.queryOne('SELECT * FROM projects WHERE id = $1', [project.id]);
        console.log('Final DB state for port:', updatedProject.port);
        console.log('Final DB state for env_vars:', updatedProject.env_vars);
        console.log('Final DB state for build_command:', updatedProject.build_command);
        console.log('Deployment test completed successfully!');

        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
})();
