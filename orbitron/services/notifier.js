/**
 * Sends a notification to a webhook URL (Discord, Slack, etc.)
 * @param {string} webhookUrl - The webhook URL
 * @param {object} messageData - Payload containing title, message, status (success/error/info)
 */
async function sendNotification(webhookUrl, messageData) {
    if (!webhookUrl) return false;

    try {
        const isDiscord = webhookUrl.includes('discord.com');
        let payload = {};

        const { title, message, status, project, url } = messageData;
        const color = status === 'success' ? 3066993 : (status === 'error' ? 15158332 : 3447003); // Green, Red, Blue
        const emoji = status === 'success' ? '✅' : (status === 'error' ? '❌' : 'ℹ️');

        if (isDiscord) {
            payload = {
                embeds: [{
                    title: `${emoji} ${title}`,
                    description: message,
                    color: color,
                    fields: [],
                    timestamp: new Date().toISOString()
                }]
            };
            if (project) payload.embeds[0].fields.push({ name: 'Project', value: project, inline: true });
            if (url) payload.embeds[0].fields.push({ name: 'URL', value: url, inline: true });
        } else {
            // Generic Slack format
            let text = `${emoji} **${title}**\n${message}`;
            if (project) text += `\n**Project:** ${project}`;
            if (url) text += `\n**🔗 URL:** ${url}`;
            payload = { text: text };
        }

        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('Webhook returned error:', res.status, await res.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to send notification:', error.message);
        return false;
    }
}

module.exports = {
    sendNotification
};
